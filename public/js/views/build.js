// Build: tap a step grid and watch it become real notation.
import { h, segmented, stepper, toggle, row, sheet, toast, svgIcon, ICONS } from '../ui.js';
import { KIT } from '../kit.js';
import { PRESETS, makeGroove, cloneGroove, normalizeGroove, emptyPattern, subdivision, subdivisionLabel, isTrip, countLabel } from '../grooves.js';
import { renderPattern, LEFT, RIGHT, BEAT_GAP } from '../notation.js';
import { transport, playInstrument } from '../audio.js';
import { store } from '../store.js';

export const title = 'Build';

const STRAIGHT = ['', 'e', '&', 'a'];
const TRIPLET = ['', 'trip', 'let'];
const UNITS = 12; // grid columns per beat: 16ths span 3, 8ths 6, triplets 4

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
  const beatBtns = [0, 1, 2, 3].map((b) => h('button', {
    type: 'button', class: 'beat-toggle', 'aria-label': `Triplets on beat ${b + 1}`, onClick: () => toggleTrip(b),
  }, String(b + 1)));
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
    resSeg,
    h('div', { class: 'list' },
      row(['Triplets', h('span', { class: 'row-sub' }, 'Three per beat')],
        h('div', { class: 'beat-toggles', role: 'group', 'aria-label': 'Triplet beats' }, beatBtns)),
      row(['Long notes', h('span', { class: 'row-sub' }, 'Write halves and dotted quarters')], longSwitch),
      row('Metronome', toggle(S.click, (v) => {
        S.click = v;
        store.set('build.click', v);
      }, 'Metronome'))),
    h('p', { class: 'footnote' }, 'Tap a square to add a note — the staff writes it for you. Tap an instrument name to hear it.'),
  );

  els = { name, sub, staffHost, grid, playBtn, resSeg, beatBtns, longSwitch };
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
  els.beatBtns.forEach((b, i) => {
    b.classList.toggle('on', isTrip(p, i));
    b.setAttribute('aria-pressed', isTrip(p, i));
  });
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
  if (isTrip(p, b)) return TRIPLET.map((t, j) => ({ slot: b * 4 + j, label: j ? t : String(b + 1) }));
  const out = [];
  for (let j = 0; j < 4; j += S.res) out.push({ slot: b * 4 + j, label: j ? STRAIGHT[j] : String(b + 1) });
  return out;
}

function renderGrid() {
  const { grid } = els;
  const beat = `repeat(${UNITS}, minmax(0, 1fr))`;
  grid.style.gridTemplateColumns = `${LEFT}px ${[beat, beat, beat, beat].join(` ${BEAT_GAP}px `)} ${RIGHT}px`;
  grid.replaceChildren();
  const place = (rowN, b, i, n) => {
    const span = UNITS / n;
    return { gridRow: String(rowN), gridColumn: `${2 + b * (UNITS + 1) + i * span} / span ${span}` };
  };
  for (let b = 0; b < 4; b++) {
    const cols = beatCols(b);
    cols.forEach((c, i) => grid.append(h('div', {
      class: `count${i === 0 ? ' beat' : ''}${isTrip(S.groove.pattern, b) ? ' trip' : ''}`,
      'data-slot': c.slot,
      style: place(1, b, i, cols.length),
    }, c.label)));
  }
  KIT.forEach((k, r) => {
    grid.append(h('button', {
      type: 'button', class: 'lbl', title: `Hear the ${k.name}`, style: { gridRow: String(r + 2), gridColumn: '1' },
      onClick: () => playInstrument(k.id),
    }, k.label));
    for (let b = 0; b < 4; b++) {
      const cols = beatCols(b);
      cols.forEach((c, i) => {
        const on = !!S.groove.pattern[k.id][c.slot];
        const cell = h('button', {
          type: 'button',
          class: `cell ${k.family}${on ? ' on' : ''}${b % 2 ? ' alt' : ''}`,
          'data-slot': c.slot,
          'aria-pressed': on,
          'aria-label': `${k.name} on ${countLabel(c.slot, S.groove.pattern)}`,
          style: place(r + 2, b, i, cols.length),
          onClick: () => toggleCell(k, c.slot, cell),
        });
        grid.append(cell);
      });
    }
  });
  highlight(S.slot);
}

function edited() {
  if (S.groove.name !== 'My groove') S.groove.name = 'My groove';
  els.name.textContent = S.groove.name;
  els.sub.textContent = subdivisionLabel(S.groove);
  save();
}

function toggleCell(k, slot, cell) {
  const row = S.groove.pattern[k.id];
  row[slot] = row[slot] ? 0 : 1;
  cell.classList.toggle('on', !!row[slot]);
  cell.setAttribute('aria-pressed', !!row[slot]);
  if (row[slot]) playInstrument(k.id);
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
    const old = row.slice(b * 4, b * 4 + 4);
    if (toTrip) lost += old[3];
    for (let j = 0; j < 4; j++) row[b * 4 + j] = j < 3 ? old[j] : 0;
  }
  p.trip = p.trip || [0, 0, 0, 0];
  p.trip[b] = toTrip ? 1 : 0;
  if (!p.trip.some(Boolean)) delete p.trip;
  const resChanged = fitRes();
  edited();
  renderAll();
  if (lost) {
    toast(`Removed ${lost} note${lost === 1 ? '' : 's'} on the “a”`, { label: 'Undo', onClick: () => { S.groove = prev; save(); renderAll(); } });
  } else if (resChanged) toast('Switched to the 16th-note grid');
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
  transport.start({
    getBpm: () => S.bpm,
    getPattern: () => S.groove.pattern,
    loops: Infinity,
    playGroove: true,
    metronome: () => S.click,
    onEvent: (ev) => {
      if (ev.type !== 'step') return;
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
  S.groove = { name: 'My groove', pattern: emptyPattern() };
  save();
  renderAll();
  toast('Cleared', {
    label: 'Undo',
    onClick: () => {
      S.groove = prev;
      save();
      renderAll();
    },
  });
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
