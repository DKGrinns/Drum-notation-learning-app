// Build: tap a step grid and watch it become real notation.
import { h, segmented, stepper, toggle, row, sheet, toast, svgIcon, ICONS } from '../ui.js';
import { KIT } from '../kit.js';
import { PRESETS, makeGroove, cloneGroove, normalizeGroove, emptyPattern, subdivision, subdivisionLabel } from '../grooves.js';
import { renderPattern, LEFT, RIGHT } from '../notation.js';
import { transport, playInstrument } from '../audio.js';
import { store } from '../store.js';

export const title = 'Build';

const COUNTS = ['1', 'e', '&', 'a', '2', 'e', '&', 'a', '3', 'e', '&', 'a', '4', 'e', '&', 'a'];

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
    res: store.get('build.res', 2), // 2 = 8th-note grid, 1 = 16th-note grid
    click: store.get('build.click', false),
    playing: false,
    col: null,
  };
  if (S.res === 2 && subdivision(S.groove) === 16) S.res = 1;

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
      row('Metronome', toggle(S.click, (v) => {
        S.click = v;
        store.set('build.click', v);
      }, 'Metronome'))),
    h('p', { class: 'footnote' }, 'Tap a square to add a note — the staff writes it for you. Tap an instrument name to hear it.'),
  );

  els = { name, sub, staffHost, grid, playBtn, resSeg };
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

function renderAll() {
  els.name.textContent = S.groove.name;
  els.sub.textContent = subdivisionLabel(S.groove);
  renderGrid();
  renderStaff();
}

function renderStaff() {
  staff = renderPattern(els.staffHost, { pattern: S.groove.pattern, res: S.res });
}

function renderGrid() {
  const cols = 16 / S.res;
  const { grid } = els;
  grid.style.gridTemplateColumns = `${LEFT}px repeat(${cols}, minmax(0, 1fr)) ${RIGHT}px`;
  grid.replaceChildren();
  grid.append(h('div'));
  for (let c = 0; c < cols; c++) {
    const slot = c * S.res;
    grid.append(h('div', { class: `count${slot % 4 === 0 ? ' beat' : ''}`, 'data-col': c }, COUNTS[slot]));
  }
  grid.append(h('div'));
  for (const k of KIT) {
    grid.append(h('button', {
      type: 'button', class: 'lbl', title: `Hear the ${k.name}`, onClick: () => playInstrument(k.id),
    }, k.label));
    for (let c = 0; c < cols; c++) {
      const slot = c * S.res;
      const on = !!S.groove.pattern[k.id][slot];
      const cell = h('button', {
        type: 'button',
        class: `cell ${k.family}${on ? ' on' : ''}${Math.floor(slot / 4) % 2 ? ' alt' : ''}`,
        'data-col': c,
        'aria-pressed': on,
        'aria-label': `${k.name} on ${COUNTS[slot]}`,
        onClick: () => toggleCell(k, slot, cell),
      });
      grid.append(cell);
    }
    grid.append(h('div'));
  }
  highlightCol(S.col);
}

function toggleCell(k, slot, cell) {
  const row = S.groove.pattern[k.id];
  row[slot] = row[slot] ? 0 : 1;
  cell.classList.toggle('on', !!row[slot]);
  cell.setAttribute('aria-pressed', !!row[slot]);
  if (row[slot]) playInstrument(k.id);
  if (S.groove.name !== 'My groove') S.groove.name = 'My groove';
  els.name.textContent = S.groove.name;
  els.sub.textContent = subdivisionLabel(S.groove);
  save();
  renderStaff();
  if (S.playing) staff.setPlayhead(S.col == null ? null : S.col * S.res);
}

function setRes(v) {
  if (v === 2 && subdivision(S.groove) === 16) {
    els.resSeg.set(1);
    toast('This groove uses 16th notes');
    return;
  }
  S.res = v;
  store.set('build.res', v);
  S.col = null;
  renderGrid();
  renderStaff();
}

function highlightCol(col) {
  for (const e of els.grid.querySelectorAll('.now')) e.classList.remove('now');
  if (col == null) return;
  for (const e of els.grid.querySelectorAll(`[data-col="${col}"]`)) e.classList.add('now');
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
      if (ev.type !== 'step' || ev.slot % S.res) return;
      S.col = ev.slot / S.res;
      staff.setPlayhead(ev.slot);
      highlightCol(S.col);
    },
  });
}

function stop() {
  transport.stop();
  S.playing = false;
  S.col = null;
  staff?.setPlayhead(null);
  highlightCol(null);
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
          if (subdivision(g) === 16 && S.res === 2) {
            S.res = 1;
            els.resSeg.set(1);
            store.set('build.res', 1);
          }
          save();
          renderAll();
        },
      };
    }),
  });
}
