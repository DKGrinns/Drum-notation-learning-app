// Build: tap a step grid and watch it become real notation.
import { h, segmented, stepper, toggle, row, sheet, toast, svgIcon, ICONS } from '../ui.js';
import { KIT } from '../kit.js';
import {
  PRESETS, METERS, NOTE, NOTE_TYPES, noteTypeFits, makeGroove, cloneGroove, normalizeGroove, emptyPattern,
  subdivision, subdivisionLabel, isTrip, isCompound, countLabel, beatsOf, meterOf,
} from '../grooves.js';
import { renderPattern, LEFT, RIGHT, BEAT_GAP } from '../notation.js';
import { transport, playInstrument, playNote } from '../audio.js';
import { store } from '../store.js';

export const title = 'Build';

const STRAIGHT = ['', 'e', '&', 'a'];
const TRIPLET = ['', 'trip', 'let'];
const COMPOUND = ['', '&', 'a'];
const UNITS = 12; // grid columns per beat: 16ths span 3, 8ths 6, triplets 4
const TYPE_NAME = Object.fromEntries(NOTE_TYPES.map((t) => [t.value, t.name]));

let S = null;
let els = null;
let staff = null;
let ro = null;

export function loadMyGroove() {
  return normalizeGroove(store.get('myGroove')) || makeGroove(PRESETS[1].name, PRESETS[1].spec);
}

export function mount(root, nav) {
  S = {
    groove: loadMyGroove(),
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
  const grid = h('div', { class: 'grid', role: 'grid', 'aria-label': 'Step grid' });
  const playBtn = h('button', { type: 'button', class: 'play-btn', onClick: togglePlay });
  const bpmVal = h('span', { class: 'tempo-val' }, S.bpm);
  const resSeg = segmented(
    [{ value: 2, label: '8th notes' }, { value: 1, label: '16th notes' }],
    S.res,
    setRes,
    'Grid resolution',
  );
  const brushSeg = segmented(NOTE_TYPES.map((t) => ({ value: t.value, label: t.label })), S.brush, (v) => {
    S.brush = v;
    const t = NOTE_TYPES.find((x) => x.value === v);
    if (t.on) toast(`${t.label}: tap a ${t.on.length === 1 ? 'hi-hat' : 'snare or tom'} note`);
  }, 'Note type');
  brushSeg.classList.add('brush');
  const meterSeg = segmented(Object.keys(METERS).map((m) => ({ value: m, label: m })), meterOf(S.groove.pattern).id, setMeter, 'Time signature');
  const beatToggles = h('div', { class: 'beat-toggles', role: 'group', 'aria-label': 'Triplet beats' });
  const tripRow = row(['Triplets', h('span', { class: 'row-sub' }, 'Three per beat')], beatToggles);
  const longSwitch = toggle(!!S.groove.pattern.long, setLong, 'Long notes');

  root.append(
    h('section', { class: 'card score' },
      h('div', { class: 'card-head' }, name, sub),
      staffHost,
      grid),
    h('div', { class: 'transport' },
      playBtn,
      h('div', { class: 'tempo' },
        h('div', { class: 'tempo-read' }, bpmVal, h('span', { class: 'tempo-unit' }, 'BPM')),
        stepper({
          value: S.bpm, min: 40, max: 220, step: 2, label: 'tempo',
          onChange: (v) => {
            S.bpm = v;
            bpmVal.textContent = v;
            store.set('build.bpm', v);
          },
        }))),
    h('div', { class: 'section-label' }, 'Write'),
    brushSeg,
    resSeg,
    h('div', { class: 'section-label' }, 'Time signature'),
    meterSeg,
    h('div', { class: 'list' },
      tripRow,
      row(['Long notes', h('span', { class: 'row-sub' }, 'Write halves and dotted quarters')], longSwitch),
      row('Metronome', toggle(S.click, (v) => {
        S.click = v;
        store.set('build.click', v);
      }, 'Metronome'))),
    h('p', { class: 'footnote' },
      'Tap a square to add a note — the staff writes it for you. Pick Accent, Ghost, Open or Flam above, then tap a note to change it. Tap an instrument name to hear it.'),
  );

  els = { name, sub, staffHost, grid, playBtn, resSeg, meterSeg, beatToggles, tripRow, longSwitch };
  updatePlayBtn();
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
  store.set('myGroove', S.groove);
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
  els.sub.textContent = subdivisionLabel(S.groove);
  els.meterSeg.set(meterOf(p).id);
  // Triplet toggles: one per beat; compound meters are already three per beat.
  els.tripRow.hidden = isCompound(p);
  els.resSeg.hidden = isCompound(p);
  els.beatToggles.replaceChildren(...Array.from({ length: beatsOf(p) }, (_, b) => h('button', {
    type: 'button',
    class: `beat-toggle${isTrip(p, b) ? ' on' : ''}`,
    'aria-pressed': isTrip(p, b),
    'aria-label': `Triplets on beat ${b + 1}`,
    onClick: () => toggleTrip(b),
  }, String(b + 1))));
  els.longSwitch.checked = !!p.long;
  renderGrid();
  renderStaff();
}

function renderStaff() {
  staff = renderPattern(els.staffHost, { pattern: S.groove.pattern, layout: 'grid', res: S.res, fit: false });
  if (S.playing && S.slot != null) staff.setPlayhead(S.slot);
}

/** The columns of one beat: [{ slot, j, label }] */
function beatCols(b) {
  const p = S.groove.pattern;
  if (isTrip(p, b)) {
    const names = isCompound(p) ? COMPOUND : TRIPLET;
    return names.map((t, j) => ({ slot: b * 4 + j, label: j ? t : String(b + 1) }));
  }
  const out = [];
  for (let j = 0; j < 4; j += S.res) out.push({ slot: b * 4 + j, label: j ? STRAIGHT[j] : String(b + 1) });
  return out;
}

function cellLabel(k, slot) {
  const v = S.groove.pattern[k.id][slot];
  const what = v > 1 ? `${TYPE_NAME[v]} on ${k.name}` : k.name;
  return `${what} on ${countLabel(slot, S.groove.pattern)}`;
}

function renderGrid() {
  const { grid } = els;
  const p = S.groove.pattern;
  const beats = beatsOf(p);
  const beat = `repeat(${UNITS}, minmax(0, 1fr))`;
  grid.style.gridTemplateColumns = `${LEFT}px ${Array(beats).fill(beat).join(` ${BEAT_GAP}px `)} ${RIGHT}px`;
  grid.replaceChildren();
  const place = (rowN, b, i, n) => {
    const span = UNITS / n;
    return { gridRow: String(rowN), gridColumn: `${2 + b * (UNITS + 1) + i * span} / span ${span}` };
  };
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
  highlight(S.slot);
}

function paintCell(cell, k, slot, b = slot >> 2) {
  const v = S.groove.pattern[k.id][slot];
  cell.className = `cell ${k.family}${v ? ' on' : ''}${v > 1 ? ` v${v}` : ''}${b % 2 ? ' alt' : ''}`;
  cell.setAttribute('aria-pressed', !!v);
  cell.setAttribute('aria-label', cellLabel(k, slot));
  if (S.slot === slot) cell.classList.add('now');
}

function edited() {
  if (S.groove.name !== 'My groove') S.groove.name = 'My groove';
  els.name.textContent = S.groove.name;
  els.sub.textContent = subdivisionLabel(S.groove);
  save();
}

/**
 * With the Note brush, a tap adds or removes a note. With another brush, it
 * turns the note into that kind (adding it if needed), or back to a plain note.
 */
function tapCell(k, slot, cell) {
  const row = S.groove.pattern[k.id];
  const type = NOTE_TYPES.find((t) => t.value === S.brush);
  if (S.brush === NOTE.HIT) {
    row[slot] = row[slot] ? 0 : NOTE.HIT;
  } else if (!noteTypeFits(type, k.id)) {
    toast(`${type.label} works on ${type.on.length === 1 ? 'the hi-hat' : 'the snare and toms'}`);
    return;
  } else {
    row[slot] = row[slot] === S.brush ? NOTE.HIT : S.brush;
  }
  paintCell(cell, k, slot);
  if (row[slot]) playNote(k.id, row[slot]);
  edited();
  renderStaff();
}

/**
 * Switch one beat between straight and triplets. Notes move to the nearest
 * spot: "&" ↔ "let" (that's how a swung 8th feels), "e" ↔ "trip"; an "a" has no
 * triplet partner and is removed.
 */
function toggleTrip(b) {
  const prev = cloneGroove(S.groove);
  const p = S.groove.pattern;
  const toTrip = !isTrip(p, b);
  let lost = 0;
  for (const k of KIT) {
    const row = p[k.id];
    if (toTrip && row[b * 4 + 3]) lost++;
    if (toTrip) row[b * 4 + 3] = 0;
  }
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
 * Change the time signature, keeping as much of the groove as fits.
 * Beats are copied in order. Going to 6/8 or 12/8, triplet beats carry over
 * exactly and a straight beat loses its "a". Coming back from 6/8 or 12/8, the
 * beats become triplets, so the groove sounds the same.
 */
function setMeter(m) {
  const prev = cloneGroove(S.groove);
  const old = S.groove.pattern;
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
  if (old.long) next.long = true;
  S.groove.pattern = next;
  fitRes();
  edited();
  renderAll();
  if (lost) toast(`Removed ${lost} note${lost === 1 ? '' : 's'} that didn’t fit`, { label: 'Undo', onClick: () => restore(prev) });
}

function restore(g) {
  S.groove = g;
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
    getPattern: () => S.groove.pattern,
    loops: Infinity,
    playGroove: true,
    metronome: () => S.click,
    onEvent: (ev) => {
      if (ev.type === 'interrupt') return stop();
      if (ev.type !== 'step') return;
      // A new meter needs a fresh start of the transport.
      if (beatsOf(S.groove.pattern) !== beatsOf(startPattern)) {
        stop();
        start();
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
  updatePlayBtn();
}

function updatePlayBtn() {
  els.playBtn.replaceChildren(svgIcon(S.playing ? ICONS.stop : ICONS.play));
  els.playBtn.setAttribute('aria-label', S.playing ? 'Stop' : 'Play');
}

function clear() {
  const prev = cloneGroove(S.groove);
  S.groove = { name: 'My groove', pattern: emptyPattern(meterOf(S.groove.pattern).id) };
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
          S.groove = g;
          fitRes();
          save();
          renderAll();
        },
      };
    }),
  });
}
