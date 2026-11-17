// Build: tap a step grid and watch it become real notation.
import { h, segmented, stepper, toggle, row, sheet, modal, toast, svgIcon, ICONS } from '../ui.js';
import { loadLibrary, saveToLibrary, deleteFromLibrary, restoreToLibrary, sameBars, hasNotes, grooveToMidi, fileName } from '../library.js';
import { download, shareGroove, groovePng } from '../export.js';
import { KIT } from '../kit.js';
import {
  PRESETS, METERS, NOTE, NOTE_TYPES, noteTypeFits, makeGroove, clonePattern, normalizeGroove, normalizeChart, emptyPattern,
  subdivision, subdivisionLabel, isTrip, isCompound, countLabel, beatsOf, meterOf, repeatForm, isLongBeat, beatLen, isFine, noteAt, setNote,
} from '../grooves.js';
import { renderPattern, renderChart, LEFT, RIGHT, BEAT_GAP, gridWeight, gridMinWidth } from '../notation.js';
import { transport, playInstrument, playNote } from '../audio.js';
import { store } from '../store.js';

export const title = 'Build';

const STRAIGHT = ['', 'e', '&', 'a'];
const TRIPLET = ['', 'trip', 'let'];
const COMPOUND = ['', '&', 'a'];
const UNITS = 24; // grid columns per beat: 16ths span 6, 8ths 12, triplets 8 (a beat of 32nds is twice as wide: 48 columns, each 32nd spanning 6)
const TYPE_NAME = Object.fromEntries(NOTE_TYPES.map((t) => [t.value, t.name]));
const MAX_BARS = 16;

let S = null;
let els = null;
let staff = null;
let ro = null;

export function loadMyGroove() {
  return normalizeGroove(store.get('myGroove')) || makeGroove(PRESETS[1].name, PRESETS[1].spec);
}

/** Every bar you've written (one, unless you added more). */
function loadMyBars() {
  const c = normalizeChart({ bars: store.get('myBars') });
  return c && c.bars.length > 1 ? c.bars : [loadMyGroove().pattern];
}

/** Your bars as a chart, or null if you've only written one bar. */
export function loadMyChart() {
  const bars = loadMyBars();
  if (bars.length < 2) return null;
  return { name: 'My groove', bars, ...(bars.length >= 3 && store.get('myRepeat', false) ? repeatForm(bars.length) : {}) };
}

/** The kinds of note with a button of their own; the others are behind "More". */
const COMMON_NOTES = [NOTE.HIT, NOTE.ACCENT, NOTE.GHOST, NOTE.OPEN, NOTE.FLAM];
const MORE = -1;
const NOTE_HELP = {
  hit: 'An ordinary note',
  accent: 'Louder than the notes around it',
  ghost: 'Very soft, on the snare or toms',
  open: 'Hi-hat with your foot lifted',
  flam: 'Two strokes almost together',
  cross: 'Cross-stick: the stick laid across the snare',
  bell: 'The bell of the ride cymbal',
  rim: 'Rimshot: head and rim together',
  drag: 'Two quick soft strokes, then the note',
  roll: 'A buzz held for the whole note',
  tie: 'Held over from the note before, not struck',
};

/** Choose any kind of note. onCancel runs if the sheet is closed without choosing. */
function openNoteTypes(onPick, onCancel) {
  sheet({
    title: 'Kind of note',
    items: NOTE_TYPES.map((t) => ({ label: t.label, detail: NOTE_HELP[t.id], checked: t.value === S.brush, onClick: () => onPick(t.value) })),
  });
  onCancel?.(); // put the buttons back as they were; a choice redraws them again
}

function openMeters() {
  const detail = (m) => (m.group ? `${m.name}: ${m.top} 8th notes, counted ${m.group}`
    : m.compound ? `${m.name}: ${m.beats} beats of three 8ths`
    : `${m.name}: ${m.beats} beats`);
  sheet({
    title: 'Time signature',
    items: Object.values(METERS).map((m) => ({ label: m.id, detail: detail(m), checked: m.id === meterOf(S.groove.pattern).id, onClick: () => setMeter(m.id) })),
  });
}

function openHelp() {
  const tips = [
    ['Add a note', 'Tap a square. Tap it again to take the note away.'],
    ['Change the kind of note', 'Pick a kind above the settings (Accent, Ghost, More…), then tap a note to change it. Tap it again to change it back.'],
    ['Hear a drum', 'Tap its name at the left of the grid.'],
    ['Stickings', 'The Sticking row writes R or L under a note.'],
    ['More bars', 'Press + next to the bar numbers. The new bar starts as a copy of the one you’re on. You can have up to 16.'],
    ['Repeats', 'With three or more bars you can turn on a repeat with two endings: the last two bars become the endings.'],
    ['Play it', 'Your bars play in order here, and show up in the Play tab as “My groove”.'],
  ];
  modal({
    title: 'How to write a groove',
    content: h('div', { class: 'list help-list' }, tips.map(([t, d]) => h('div', { class: 'row' }, h('span', { class: 'row-main' }, h('span', null, t), h('span', { class: 'row-sub' }, d))))),
  });
}

export function mount(root, nav) {
  const bars = loadMyBars();
  S = {
    // `groove` is the bar being edited: groove.pattern is always bars[bar].
    bars,
    bar: 0,
    repeat: bars.length >= 3 && !!store.get('myRepeat', false), // the last two bars are 1st and 2nd endings
    groove: { name: loadMyGroove().name, pattern: bars[0] },
    bpm: store.get('build.bpm', 90),
    res: store.get('build.res', 2), // straight beats: 2 = 8th-note grid, 1 = 16th-note grid
    click: store.get('build.click', false),
    brush: NOTE.HIT,
    playing: false,
    slot: null,
  };
  fitRes();

  nav.set({
    left: { label: 'Clear', onClick: clear },
    right: { label: 'Presets', onClick: openPresets },
  });

  const name = h('div', { class: 'card-title' });
  const sub = h('div', { class: 'card-sub' });
  const staffHost = h('div', { class: 'staff-host' });
  const barTabs = h('div', { class: 'bar-tabs', role: 'group', 'aria-label': 'Bars' });
  const grid = h('div', { class: 'grid', role: 'grid', 'aria-label': 'Step grid' });
  const wide = h('div', { class: 'build-wide' }, staffHost, grid);
  const playBtn = h('button', { type: 'button', class: 'play-btn', onClick: togglePlay });
  const bpmVal = h('span', { class: 'tempo-val' }, S.bpm);
  const resSeg = segmented(
    [{ value: 2, label: '8ths' }, { value: 1, label: '16ths' }],
    S.res,
    setRes,
    'Grid resolution',
  );
  // The kind of note to write: the everyday ones as buttons, the rest behind "More".
  const brushHost = h('div', { class: 'brush-host' });
  const setBrush = (v) => {
    S.brush = v;
    const t = NOTE_TYPES.find((x) => x.value === v);
    if (t.on) toast(`${t.label}: tap a note on ${t.where}`);
    drawBrush();
  };
  const drawBrush = () => {
    const extra = NOTE_TYPES.find((t) => t.value === S.brush && !COMMON_NOTES.includes(t.value));
    const options = [
      ...NOTE_TYPES.filter((t) => COMMON_NOTES.includes(t.value)).map((t) => ({ value: t.value, label: t.label })),
      { value: extra ? extra.value : MORE, label: extra ? `${extra.label} ▾` : 'More ▾' },
    ];
    const seg = segmented(options, S.brush, (v) => (v === MORE ? openNoteTypes(setBrush, drawBrush) : setBrush(v)), 'Note type');
    // Pressing the last button again (already showing an extra kind) reopens the list.
    seg.lastChild.addEventListener('click', () => extra && openNoteTypes(setBrush, drawBrush));
    brushHost.replaceChildren(seg);
  };
  drawBrush();
  const meterVal = h('span', { class: 'row-value' });
  const beatToggles = h('div', { class: 'beat-toggles', role: 'group', 'aria-label': 'Triplet beats' });
  const tripRow = row(['Triplets', h('span', { class: 'row-sub' }, 'Three per beat')], beatToggles);
  const longSwitch = toggle(!!S.groove.pattern.long, setLong, 'Long notes');
  const fineToggles = h('div', { class: 'beat-toggles', role: 'group', 'aria-label': 'Finer beats' });
  const fineRow = row(['Finer notes', h('span', { class: 'row-sub' }, '32nds, or sextuplets on a triplet beat')], fineToggles);
  const bpmStepper = stepper({
    value: S.bpm, min: 40, max: 220, step: 2, label: 'tempo',
    onChange: (v) => {
      S.bpm = v;
      bpmVal.textContent = v;
      store.set('build.bpm', v);
    },
  });
  const savedCount = h('span', { class: 'row-value' });
  const repeatSwitch = toggle(S.repeat, (v) => {
    S.repeat = v;
    save();
    renderAll();
  }, 'Repeat with two endings');
  const repeatRow = row(['Repeat with two endings', h('span', { class: 'row-sub' }, 'The last two bars become the 1st and 2nd endings')], repeatSwitch);
  const rowBtn = (label, sub, onClick, right) => h('button', { type: 'button', class: 'row row-btn', onClick },
    h('span', { class: 'row-main' }, h('span', null, label), h('span', { class: 'row-sub' }, sub)), right, svgIcon(ICONS.chevron, 'icon chevron'));
  const resRow = row(['Grid', h('span', { class: 'row-sub' }, 'The smallest note a square stands for')], resSeg);

  root.append(
    h('section', { class: 'card score' },
      h('div', { class: 'card-head' }, name, sub),
      barTabs,
      h('div', { class: 'build-scroll' }, wide)),
    h('div', { class: 'transport' },
      playBtn,
      h('div', { class: 'tempo' },
        h('div', { class: 'tempo-read' }, bpmVal, h('span', { class: 'tempo-unit' }, 'BPM')),
        bpmStepper)),
    h('div', { class: 'section-label' }, 'Kind of note'),
    brushHost,
    h('div', { class: 'section-label' }, 'Rhythm'),
    h('div', { class: 'list' },
      rowBtn('Time signature', 'Beats in a bar', openMeters, meterVal),
      resRow,
      tripRow,
      fineRow,
      row(['Long notes', h('span', { class: 'row-sub' }, 'Write halves and dotted quarters')], longSwitch)),
    h('div', { class: 'section-label' }, 'Bars and playback'),
    h('div', { class: 'list' },
      repeatRow,
      rowBtn('See the whole chart', 'Every bar, written out together', openWhole),
      row(['Metronome', h('span', { class: 'row-sub' }, 'A click on each beat while it plays')], toggle(S.click, (v) => {
        S.click = v;
        store.set('build.click', v);
      }, 'Metronome'))),
    h('div', { class: 'section-label' }, 'Keep and share'),
    h('div', { class: 'list' },
      rowBtn('Save this groove', 'Keep it in your saved grooves', saveCurrent),
      rowBtn('Saved grooves', 'Open one you saved earlier', openLibrary, savedCount),
      rowBtn('Share or export', 'A link, a MIDI file or a picture', openShare)),
    h('div', { class: 'list' },
      rowBtn('How to write a groove', 'Notes, bars, repeats and stickings', openHelp)),
    h('p', { class: 'footnote' }, 'Tap a square to add a note, and the staff writes it for you. Your bars show up in Play as “My groove”.'),
  );

  els = { name, sub, staffHost, barTabs, grid, wide, playBtn, resSeg, resRow, meterVal, beatToggles, tripRow, longSwitch, bpmVal, bpmStepper, savedCount, repeatSwitch, repeatRow, fineToggles };
  updatePlayBtn();
  updateSavedCount();
  renderAll();
  ro = new ResizeObserver(() => renderStaff());
  ro.observe(staffHost);
}

export function unmount() {
  ro?.disconnect();
  transport.stop();
  S.playing = false;
}

function save() {
  store.set('myGroove', { name: S.groove.name, pattern: S.bars[0] });
  store.set('myBars', S.bars.length > 1 ? S.bars : null);
  store.set('myRepeat', S.repeat);
}

/** The bar numbers in the order they play (with the repeat, if it is on). */
const playOrder = () => (S.repeat ? repeatForm(S.bars.length).order : S.bars.map((_, i) => i));
/** 1 or 2 if this bar is the first or second ending, else 0. */
const endingOf = (i) => (S.repeat ? repeatForm(S.bars.length).endings.indexOf(i) + 1 : 0);

/** Everything needed to undo a change. */
const snapshot = () => ({ name: S.groove.name, bars: S.bars.map(clonePattern), bar: S.bar, repeat: S.repeat });

/** Replace the bar being edited. */
function setPattern(p) {
  S.bars[S.bar] = p;
  S.groove.pattern = p;
}

const subText = () => `${subdivisionLabel(S.groove)}${S.bars.length > 1 ? ` · bar ${S.bar + 1} of ${S.bars.length}` : ''}${['', ' · 1st ending', ' · 2nd ending'][endingOf(S.bar)]}`;

function renderBars() {
  const n = S.bars.length;
  const chip = (label, props) => h('button', { type: 'button', ...props }, label);
  els.barTabs.replaceChildren(...[
    h('span', { class: 'bar-tabs-label' }, 'Bar'),
    ...S.bars.map((_, i) => chip(String(i + 1), {
      class: `beat-toggle${i === S.bar ? ' on' : ''}${endingOf(i) ? ' ending' : ''}`, 'aria-pressed': i === S.bar, 'aria-label': `Bar ${i + 1}${['', ', first ending', ', second ending'][endingOf(i)]}`, 'data-bar': i, onClick: () => selectBar(i),
    })),
    n < MAX_BARS && chip('+', { class: 'beat-toggle tool', 'aria-label': 'Add a bar (a copy of this one)', onClick: addBar }),
    n > 1 && chip('−', { class: 'beat-toggle tool', 'aria-label': 'Remove this bar', onClick: removeBar }),
  ].filter(Boolean));
}

function selectBar(i) {
  S.bar = i;
  S.groove.pattern = S.bars[i];
  S.slot = null;
  fitRes();
  renderAll();
}

function addBar() {
  S.bars.splice(S.bar + 1, 0, clonePattern(S.groove.pattern));
  S.groove.name = 'My groove';
  save();
  selectBar(S.bar + 1);
}

function removeBar() {
  const prev = snapshot();
  S.bars.splice(S.bar, 1);
  if (S.bars.length < 3) S.repeat = false;
  save();
  selectBar(Math.min(S.bar, S.bars.length - 1));
  toast(`Removed bar ${prev.bar + 1}`, { label: 'Undo', onClick: () => restore(prev) });
}

/** A groove with 16th notes in its straight beats needs the 16th-note grid. */
function fitRes() {
  if (S.res === 2 && subdivision(S.groove) === 16) {
    S.res = 1;
    els?.resSeg.set(1);
    store.set('build.res', 1);
    return true;
  }
  return false;
}

function renderAll() {
  const p = S.groove.pattern;
  els.name.textContent = S.groove.name;
  els.sub.textContent = subText();
  els.meterVal.textContent = meterOf(p).id;
  renderBars();
  // Triplet toggles: one per beat; compound meters are already three per beat.
  els.tripRow.hidden = isCompound(p);
  els.resRow.hidden = isCompound(p);
  els.beatToggles.replaceChildren(...Array.from({ length: beatsOf(p) }, (_, b) => h('button', {
    type: 'button',
    class: `beat-toggle${isTrip(p, b) ? ' on' : ''}`,
    'aria-pressed': isTrip(p, b),
    'aria-label': `Triplets on beat ${b + 1}`,
    hidden: isLongBeat(p, b), // already three 8ths long
    onClick: () => toggleTrip(b),
  }, String(b + 1))));
  // Finer-note toggles: one per beat.
  els.fineToggles.replaceChildren(...Array.from({ length: beatsOf(p) }, (_, b) => h('button', {
    type: 'button',
    class: `beat-toggle${isFine(p, b) ? ' on' : ''}`,
    'aria-pressed': isFine(p, b),
    'aria-label': `Finer notes on beat ${b + 1}`,
    onClick: () => toggleFine(b),
  }, String(b + 1))));
  els.longSwitch.checked = !!p.long;
  els.repeatSwitch.checked = S.repeat;
  els.repeatRow.hidden = S.bars.length < 3;
  renderGrid();
  renderStaff();
}

function renderStaff() {
  staff = renderPattern(els.staffHost, { pattern: S.groove.pattern, layout: 'grid', res: S.res, fit: false });
  if (S.playing && S.slot != null) staff.setPlayhead(S.slot);
}

/** The columns of one beat: [{ slot, j, label }] */
function beatCols(b) {
  const cols = plainCols(b);
  // A finer beat has a narrow extra column after each one: the note halfway to the next.
  return isFine(S.groove.pattern, b) ? cols.flatMap((c) => [c, { slot: c.slot + 0.5, label: '·' }]) : cols;
}

function plainCols(b) {
  const p = S.groove.pattern;
  if (isTrip(p, b)) {
    const names = isCompound(p) ? COMPOUND : TRIPLET;
    return names.map((t, j) => ({ slot: b * 4 + j, label: j ? t : String(b + 1) }));
  }
  const out = [];
  // A finer beat always shows its 16ths, whatever the grid is set to.
  for (let j = 0; j < 4; j += isFine(p, b) ? 1 : S.res) out.push({ slot: b * 4 + j, label: j ? STRAIGHT[j] : String(b + 1) });
  return out;
}

/** The columns of one beat, labelled the way this meter is counted. */
function beatColsFor(b) {
  const p = S.groove.pattern;
  const cols = beatCols(b);
  // 7/8 is counted in 8ths (1 to 7), with "&" for a 16th in between.
  if (meterOf(p).odd) for (const c of cols) if (Number.isInteger(c.slot)) c.label = countLabel(c.slot, p).split(' ').pop();
  return cols;
}

function cellLabel(k, slot) {
  const v = noteAt(S.groove.pattern, k.id, slot);
  const what = v > 1 ? `${TYPE_NAME[v]} on ${k.name}` : k.name;
  const at = countLabel(Math.floor(slot), S.groove.pattern);
  return `${what} ${Number.isInteger(slot) ? 'on' : 'just after'} ${at}`;
}

function renderGrid() {
  const { grid } = els;
  const p = S.groove.pattern;
  const beats = beatsOf(p);
  // Grid columns per beat: more for a beat that lasts longer, so every 8th is the same width.
  const units = (b) => (UNITS * gridWeight(p, b)) / 4;
  // A beat of 32nds needs room: on a narrow screen the staff and grid scroll sideways together.
  const min = gridMinWidth(p);
  els.wide.style.minWidth = min ? `${min}px` : '';
  const firstCol = (b) => {
    let col = 2;
    for (let i = 0; i < b; i++) col += units(i) + 1;
    return col;
  };
  grid.style.gridTemplateColumns = `${LEFT}px ${Array.from({ length: beats }, (_, b) => `repeat(${units(b)}, minmax(0, 1fr))`).join(` ${BEAT_GAP}px `)} ${RIGHT}px`;
  grid.replaceChildren();
  const place = (rowN, b, i, n) => {
    const span = units(b) / n;
    return { gridRow: String(rowN), gridColumn: `${firstCol(b) + i * span} / span ${span}` };
  };
  const beatCols = beatColsFor; // eslint-disable-line no-shadow
  for (let b = 0; b < beats; b++) {
    const cols = beatCols(b);
    cols.forEach((c, i) => grid.append(h('div', {
      class: `count${i === 0 ? ' beat' : ''}${isTrip(p, b) ? ' trip' : ''}`,
      'data-slot': c.slot,
      style: place(1, b, i, cols.length),
    }, c.label)));
  }
  KIT.forEach((k, r) => {
    grid.append(h('button', {
      type: 'button', class: 'lbl', title: `Hear the ${k.name}`, style: { gridRow: String(r + 2), gridColumn: '1' },
      onClick: () => playInstrument(k.id),
    }, k.label));
    for (let b = 0; b < beats; b++) {
      const cols = beatCols(b);
      cols.forEach((c, i) => {
        const cell = h('button', {
          type: 'button',
          'data-slot': c.slot,
          style: place(r + 2, b, i, cols.length),
          onClick: () => tapCell(k, c.slot, cell),
        });
        paintCell(cell, k, c.slot, b);
        grid.append(cell);
      });
    }
  });
  // Sticking: which hand plays each note (R or L), written under the staff.
  const sr = KIT.length + 2;
  grid.append(h('span', { class: 'lbl', style: { gridRow: String(sr), gridColumn: '1' } }, 'Sticking'));
  for (let b = 0; b < beats; b++) {
    const cols = beatCols(b);
    cols.forEach((c, i) => {
      if (!Number.isInteger(c.slot)) return; // sticking goes under the main notes only
      const cell = h('button', { type: 'button', 'data-slot': c.slot, style: place(sr, b, i, cols.length), onClick: () => tapStick(c.slot, cell, b) });
      paintStick(cell, c.slot, b);
      grid.append(cell);
    });
  }
  highlight(S.slot);
}

function paintStick(cell, slot, b) {
  const v = S.groove.pattern.stick?.[slot] || 0;
  cell.className = `cell stick${v ? ' on' : ''}${b % 2 ? ' alt' : ''}`;
  cell.textContent = ['', 'R', 'L'][v];
  cell.setAttribute('aria-label', `Sticking on ${countLabel(slot, S.groove.pattern)}: ${['none', 'right hand', 'left hand'][v]}`);
  if (S.slot === slot) cell.classList.add('now');
}

/** Each tap moves a sticking square on: empty, R, L, empty. */
function tapStick(slot, cell, b) {
  const p = S.groove.pattern;
  p.stick = p.stick || Array(beatsOf(p) * 4).fill(0);
  p.stick[slot] = (p.stick[slot] + 1) % 3;
  if (!p.stick.some(Boolean)) delete p.stick;
  paintStick(cell, slot, b);
  edited();
  renderStaff();
}

function paintCell(cell, k, slot, b = slot >> 2) {
  const v = noteAt(S.groove.pattern, k.id, slot);
  cell.className = `cell ${k.family}${v ? ' on' : ''}${v > 1 ? ` v${v}` : ''}${b % 2 ? ' alt' : ''}`;
  cell.setAttribute('aria-pressed', !!v);
  cell.setAttribute('aria-label', cellLabel(k, slot));
  if (S.slot === slot) cell.classList.add('now');
}

function edited() {
  if (S.groove.name !== 'My groove') S.groove.name = 'My groove';
  els.name.textContent = S.groove.name;
  els.sub.textContent = subText();
  save();
}

/**
 * With the Note brush, a tap adds or removes a note. With another brush, it
 * turns the note into that kind (adding it if needed), or back to a plain note.
 */
function tapCell(k, slot, cell) {
  const p = S.groove.pattern;
  const cur = noteAt(p, k.id, slot);
  let next = cur;
  const type = NOTE_TYPES.find((t) => t.value === S.brush);
  if (S.brush === NOTE.HIT) {
    next = cur ? 0 : NOTE.HIT;
  } else if (!noteTypeFits(type, k.id)) {
    toast(`${type.label} works on ${type.where}`);
    return;
  } else {
    next = cur === S.brush ? NOTE.HIT : S.brush;
  }
  setNote(p, k.id, slot, next);
  paintCell(cell, k, slot);
  if (next) playNote(k.id, next);
  edited();
  renderStaff();
}

/**
 * Switch one beat between straight and triplets. Notes move to the nearest
 * spot: "&" ↔ "let" (that's how a swung 8th feels), "e" ↔ "trip"; an "a" has no
 * triplet partner and is removed.
 */
function toggleTrip(b) {
  const prev = snapshot();
  const p = S.groove.pattern;
  const toTrip = !isTrip(p, b);
  let lost = 0;
  for (const k of KIT) {
    const row = p[k.id];
    if (toTrip && row[b * 4 + 3]) lost++;
    if (toTrip) row[b * 4 + 3] = 0;
  }
  if (toTrip && p.stick) p.stick[b * 4 + 3] = 0;
  if (toTrip) for (const k of KIT) if (noteAt(p, k.id, b * 4 + 3.5)) setNote(p, k.id, b * 4 + 3.5, 0);
  p.trip = p.trip || Array(beatsOf(p)).fill(0);
  p.trip[b] = toTrip ? 1 : 0;
  if (!p.trip.some(Boolean)) delete p.trip;
  const resChanged = fitRes();
  edited();
  renderAll();
  if (lost) {
    toast(`Removed ${lost} note${lost === 1 ? '' : 's'} on the “a”`, { label: 'Undo', onClick: () => restore(prev) });
  } else if (resChanged) toast('Switched to the 16th-note grid');
}

/**
 * Split a beat twice as fine (32nds, or sextuplets on a triplet beat), or put it
 * back. Going back removes the notes that sat in between.
 */
function toggleFine(b) {
  const prev = snapshot();
  const p = S.groove.pattern;
  let lost = 0;
  if (isFine(p, b)) {
    for (const k of KIT) {
      for (let j = 0; j < 4; j++) {
        if (!noteAt(p, k.id, b * 4 + j + 0.5)) continue;
        setNote(p, k.id, b * 4 + j + 0.5, 0);
        lost++;
      }
    }
    p.fine[b] = 0;
    if (!p.fine.some(Boolean)) delete p.fine;
  } else {
    p.fine = p.fine || Array(beatsOf(p)).fill(0);
    p.fine[b] = 1;
  }
  edited();
  renderAll();
  if (lost) toast(`Removed ${lost} note${lost === 1 ? '' : 's'} in between`, { label: 'Undo', onClick: () => restore(prev) });
}

/**
 * Change the time signature, keeping as much of the groove as fits.
 * Beats are copied in order. Going to 6/8 or 12/8, triplet beats carry over
 * exactly and a straight beat loses its "a". Coming back from 6/8 or 12/8, the
 * beats become triplets, so the groove sounds the same.
 */
function setMeter(m) {
  const prev = snapshot();
  let lost = 0;
  // Every bar of a chart shares one time signature.
  S.bars = S.bars.map((old) => {
    const r = convertMeter(old, m);
    lost += r.lost;
    return r.next;
  });
  S.groove.pattern = S.bars[S.bar];
  fitRes();
  edited();
  renderAll();
  if (lost) toast(`Removed ${lost} note${lost === 1 ? '' : 's'} that didn’t fit`, { label: 'Undo', onClick: () => restore(prev) });
}

function convertMeter(old, m) {
  if (METERS[m].odd || meterOf(old).odd) {
    // 7/8 has a shape of its own: keep the ordinary beats that both bars have, and drop the rest.
    const to = emptyPattern(m);
    let dropped = 0;
    for (const k of KIT) {
      old[k.id].forEach((v, s) => {
        if (!v) return;
        const b = s >> 2;
        if (b < Math.min(beatsOf(old), METERS[m].beats) && !isTrip(old, b) && !isLongBeat(to, b)) to[k.id][s] = v;
        else dropped++;
      });
    }
    return { next: to, lost: dropped };
  }
  const next = emptyPattern(m);
  const toCompound = !!METERS[m].compound;
  const fromCompound = isCompound(old);
  const beats = Math.min(beatsOf(old), METERS[m].beats);
  // 3/4 and 6/8 both hold six 8ths: keep the 8ths in order (16ths in between are lost).
  const eighths = [meterOf(old).id, m].sort().join() === '3/4,6/8';
  let lost = 0;
  for (const k of KIT) {
    old[k.id].forEach((v, s) => {
      if (!v) return;
      let to = s;
      if (eighths) {
        const e = fromCompound ? (s >> 2) * 3 + (s & 3) : (s & 1) || isTrip(old, s >> 2) ? -1 : (s >> 2) * 2 + ((s & 3) >> 1);
        to = e < 0 ? -1 : toCompound ? Math.floor(e / 3) * 4 + (e % 3) : (e >> 1) * 4 + (e & 1) * 2;
      } else if (s >> 2 >= beats || (toCompound && (s & 3) === 3)) to = -1;
      if (to < 0) lost++;
      else next[k.id][to] = v;
    });
  }
  if (!toCompound && !eighths) {
    const trip = Array.from({ length: METERS[m].beats }, (_, b) => (b < beats && (fromCompound || old.trip?.[b]) ? 1 : 0));
    if (trip.some(Boolean)) next.trip = trip;
  }
  // Sticking carries over when the beats keep their shape.
  if (old.stick && !eighths && toCompound === fromCompound) {
    const stick = Array(METERS[m].beats * 4).fill(0);
    old.stick.forEach((v, s) => {
      if (v && s >> 2 < beats) stick[s] = v;
    });
    if (stick.some(Boolean)) next.stick = stick;
  }
  if (old.long) next.long = true;
  return { next, lost };
}

function restore(snap) {
  S.bars = snap.bars;
  S.bar = Math.min(snap.bar, S.bars.length - 1);
  S.repeat = !!snap.repeat && S.bars.length >= 3;
  S.groove = { name: snap.name, pattern: S.bars[S.bar] };
  fitRes();
  save();
  renderAll();
}

function setLong(v) {
  if (v) S.groove.pattern.long = true;
  else delete S.groove.pattern.long;
  save();
  renderStaff();
}

function setRes(v) {
  S.res = v;
  if (fitRes()) {
    toast('This groove uses 16th notes');
    return;
  }
  store.set('build.res', v);
  renderGrid();
  renderStaff();
}

function highlight(slot) {
  for (const e of els.grid.querySelectorAll('.now')) e.classList.remove('now');
  if (slot == null) return;
  for (const e of els.grid.querySelectorAll(`[data-slot="${slot}"]`)) e.classList.add('now');
}

function togglePlay() {
  if (S.playing) stop();
  else start();
}

function start() {
  S.playing = true;
  updatePlayBtn();
  const startPattern = S.groove.pattern;
  transport.start({
    getBpm: () => S.bpm,
    getPattern: (n) => {
      const order = playOrder();
      return S.bars[order[n % order.length]];
    },
    loops: Infinity,
    playGroove: true,
    metronome: () => S.click,
    onEvent: (ev) => {
      if (ev.type === 'interrupt') return stop();
      if (ev.type !== 'step') return;
      // A new meter needs a fresh start of the transport.
      if (meterOf(S.groove.pattern).id !== meterOf(startPattern).id) {
        stop();
        start();
        return;
      }
      // The grid shows one bar; light it up only while that bar is the one playing.
      const order = playOrder();
      const playing = order[ev.loop % order.length];
      for (const b of els.barTabs.querySelectorAll('[data-bar]')) b.classList.toggle('now', Number(b.dataset.bar) === playing);
      if (playing !== S.bar) {
        if (S.slot != null) {
          S.slot = null;
          staff.setPlayhead(null);
          highlight(null);
        }
        return;
      }
      // On the 8th-note grid, 16th steps in straight beats have no column to light up.
      if (!els.grid.querySelector(`.count[data-slot="${ev.slot}"]`)) return;
      S.slot = ev.slot;
      staff.setPlayhead(ev.slot);
      highlight(ev.slot);
    },
  });
}

function stop() {
  transport.stop();
  S.playing = false;
  S.slot = null;
  staff?.setPlayhead(null);
  highlight(null);
  for (const b of els.barTabs.querySelectorAll('.now')) b.classList.remove('now');
  updatePlayBtn();
}

function updatePlayBtn() {
  els.playBtn.replaceChildren(svgIcon(S.playing ? ICONS.stop : ICONS.play));
  els.playBtn.setAttribute('aria-label', S.playing ? 'Stop' : 'Play');
}

// ---------- Saved grooves, sharing and export ----------

/** The groove being written, with its tempo. */
const current = () => ({ name: S.groove.name, bars: S.bars, bpm: S.bpm, repeat: S.repeat });
const describe = (e) => `${e.bars.length} bar${e.bars.length === 1 ? '' : 's'}${e.repeat ? ' with a repeat' : ''} · ${meterOf(e.bars[0]).id} · ${e.bpm} BPM`;

/** Show every bar together, the way it will look in Play. */
function openWhole() {
  const host = h('div', { class: 'staff-host' });
  modal({ title: S.groove.name, content: h('div', { class: 'lib' }, host), tall: true });
  const draw = () => renderChart(host, { bars: S.bars, full: true, endings: S.repeat ? repeatForm(S.bars.length).endings : null });
  requestAnimationFrame(draw);
}

function updateSavedCount() {
  const n = loadLibrary().length;
  els.savedCount.textContent = n || '';
}

function saveCurrent() {
  if (!hasNotes(S.bars)) return toast('Nothing to save yet — add some notes first');
  const typed = window.prompt('Name this groove', S.groove.name === 'My groove' ? '' : S.groove.name);
  if (typed == null) return;
  const e = saveToLibrary({ ...current(), name: typed });
  if (!e) return toast('Couldn’t save the groove');
  S.groove.name = e.name;
  els.name.textContent = e.name;
  save();
  updateSavedCount();
  toast(`Saved “${e.name}”`);
}

/**
 * Put a saved or shared groove ({ name, bars, bpm }) on the page. Work that
 * hasn't been saved is kept in the saved grooves first, so nothing is lost.
 */
export function openGroove(e) {
  if (S.playing) stop();
  const prev = snapshot();
  const unsaved = S.groove.name === 'My groove' && hasNotes(S.bars) && !loadLibrary().some((x) => sameBars(x.bars, S.bars));
  if (unsaved) saveToLibrary({ name: 'Unsaved groove', bars: S.bars, bpm: S.bpm });
  S.bars = e.bars.map(clonePattern);
  S.bar = 0;
  S.repeat = !!e.repeat && S.bars.length >= 3;
  S.groove = { name: e.name, pattern: S.bars[0] };
  S.bpm = e.bpm;
  els.bpmVal.textContent = S.bpm;
  els.bpmStepper.set(S.bpm);
  store.set('build.bpm', S.bpm);
  fitRes();
  save();
  renderAll();
  updateSavedCount();
  toast(unsaved ? `Opened “${e.name}”. Your old one is in Saved grooves.` : `Opened “${e.name}”`, { label: 'Undo', onClick: () => restore(prev) });
}

function openLibrary() {
  const body = h('div', { class: 'lib' });
  const m = modal({ title: 'Saved grooves', content: body, onClose: updateSavedCount });
  const draw = () => {
    const list = loadLibrary();
    body.replaceChildren(list.length
      ? h('div', { class: 'list' }, list.map((e, i) => h('div', { class: 'row lib-row' },
        h('button', {
          type: 'button', class: 'lib-open',
          onClick: () => {
            m.close();
            openGroove(e);
          },
        }, h('span', { class: 'row-main' }, h('span', null, e.name), h('span', { class: 'row-sub' }, describe(e)))),
        h('button', {
          type: 'button', class: 'lib-del', 'aria-label': `Delete ${e.name}`,
          onClick: () => {
            deleteFromLibrary(e.id);
            draw();
            toast(`Deleted “${e.name}”`, {
              label: 'Undo',
              onClick: () => {
                restoreToLibrary(e, i);
                if (body.isConnected) draw();
                updateSavedCount();
              },
            });
          },
        }, 'Delete'))))
      : h('p', { class: 'footnote' }, 'No saved grooves yet. Write one, then press “Save this groove”.'));
  };
  draw();
}

function openShare() {
  if (!hasNotes(S.bars)) return toast('Nothing to share yet — add some notes first');
  const g = current();
  sheet({
    title: 'Share or export',
    items: [
      { label: 'Share a link', detail: 'Opens this groove in Drum Reader on any device', onClick: () => shareGroove(g) },
      {
        label: 'Save as a MIDI file', detail: 'For drum software and recording programs',
        onClick: () => {
          download(grooveToMidi(g), fileName(g.name, 'mid'), 'audio/midi');
          toast('MIDI file saved to your downloads');
        },
      },
      {
        label: 'Save as a picture', detail: 'The written music, to print or send',
        onClick: () => groovePng(g).then((blob) => {
          download(blob, fileName(g.name, 'png'));
          toast('Picture saved to your downloads');
        }).catch(() => toast('Couldn’t make the picture')),
      },
    ],
  });
}

function clear() {
  const prev = snapshot();
  setPattern(emptyPattern(meterOf(S.groove.pattern).id));
  S.groove.name = 'My groove';
  save();
  renderAll();
  toast('Cleared', { label: 'Undo', onClick: () => restore(prev) });
}

function openPresets() {
  sheet({
    title: 'Presets',
    items: PRESETS.map((p) => {
      const g = makeGroove(p.name, p.spec);
      return {
        label: p.name,
        detail: `${p.level} · ${subdivisionLabel(g)}`,
        checked: S.groove.name === p.name,
        onClick: () => {
          const m = meterOf(g.pattern).id;
          if (m !== meterOf(S.groove.pattern).id) S.bars = S.bars.map((old) => convertMeter(old, m).next);
          setPattern(g.pattern);
          S.groove.name = S.bars.length > 1 ? 'My groove' : g.name;
          fitRes();
          save();
          renderAll();
        },
      };
    }),
  });
}
