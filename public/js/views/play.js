// Play: tap along to written grooves and get per-note timing feedback.
import { h, stepper, toggle, row, sheet, toast, svgIcon, ICONS } from '../ui.js';
import { KIT } from '../kit.js';
import { PRESETS, LEVEL_NAMES, makeGroove, randomGroove, normalizeGroove, usedInstruments, isEmpty, subdivisionLabel, slotPos, nearestGap } from '../grooves.js';
import { renderPattern } from '../notation.js';
import { transport, playInstrument, audioTimeAt } from '../audio.js';
import { store } from '../store.js';
import { loadMyGroove } from './build.js';

export const title = 'Play';

const ON_TIME = 0.045; // seconds either side that count as "on time"

let S = null;
let els = null;
let staff = null;
let ro = null;
let onKey = null;
let navRef = null;

function grooveOptions() {
  const saved = store.get('play.rand', {});
  return [
    { key: 'my', name: 'My groove', detail: 'From the Build tab', groove: loadMyGroove() },
    ...LEVEL_NAMES.map((lv, i) => ({
      key: `r${i}`,
      level: i,
      name: `Sight-read · ${lv}`,
      detail: 'A new groove you haven’t seen',
      groove: normalizeGroove(saved[i]) || randomGroove(i),
    })),
    ...PRESETS.map((p, i) => {
      const groove = makeGroove(p.name, p.spec);
      return { key: `p${i}`, name: p.name, detail: `${p.level} · ${subdivisionLabel(groove)}`, groove };
    }),
  ];
}

export function mount(root, nav) {
  navRef = nav;
  const options = grooveOptions();
  const savedSel = store.get('play.sel', 'p1');
  S = {
    options,
    sel: options.some((o) => o.key === savedSel) ? savedSel : 'p1',
    bpm: store.get('play.bpm', 80),
    loops: store.get('play.loops', 2),
    hear: store.get('play.hear', false),
    offset: store.get('play.offset', 0),
    phase: 'idle', // idle | countin | running | results
    expected: [],
    extras: 0,
    colors: {},
  };

  const grooveName = h('span', { class: 'row-value' });
  const staffHost = h('div', { class: 'staff-host' });
  const overlay = h('div', { class: 'count-overlay', 'aria-hidden': 'true' });
  const results = h('div', { class: 'results', hidden: true, 'aria-live': 'polite' });
  const startBtn = h('button', { type: 'button', class: 'btn-primary start', onClick: () => (S.phase === 'countin' || S.phase === 'running' ? stop(true) : start()) });
  const bpmVal = h('span', { class: 'tempo-val' }, S.bpm);
  const loopsVal = h('span', { class: 'row-value' }, S.loops);
  const offsetVal = h('span', { class: 'row-value' }, fmtOffset(S.offset));
  const pads = h('div', { class: 'pads' });

  const settings = h('div', { class: 'list' },
    row('Hear the groove', toggle(S.hear, (v) => {
      S.hear = v;
      store.set('play.hear', v);
    }, 'Hear the groove')),
    row('Times through', loopsVal, stepper({
      value: S.loops, min: 1, max: 8, label: 'times through',
      onChange: (v) => {
        S.loops = v;
        loopsVal.textContent = v;
        store.set('play.loops', v);
      },
    })),
    row('Tap offset', offsetVal, stepper({
      value: S.offset, min: -150, max: 150, step: 5, label: 'tap offset',
      onChange: (v) => {
        S.offset = v;
        offsetVal.textContent = fmtOffset(v);
        store.set('play.offset', v);
      },
    })),
  );

  const tempo = h('div', { class: 'tempo' },
    h('div', { class: 'tempo-read' }, bpmVal, h('span', { class: 'tempo-unit' }, 'BPM')),
    stepper({
      value: S.bpm, min: 40, max: 200, step: 2, label: 'tempo',
      onChange: (v) => {
        S.bpm = v;
        bpmVal.textContent = v;
        store.set('play.bpm', v);
      },
    }));

  root.append(
    h('div', { class: 'list' },
      h('button', { type: 'button', class: 'row row-btn', onClick: openPicker },
        h('span', { class: 'row-main' }, 'Groove'), grooveName, svgIcon(ICONS.chevron, 'icon chevron'))),
    h('section', { class: 'card score' }, h('div', { class: 'staff-wrap' }, staffHost, overlay), results),
    h('div', { class: 'transport' }, startBtn, tempo),
    pads,
    h('div', { class: 'section-label' }, 'Options'),
    settings,
    h('p', { class: 'footnote' },
      'You’ll hear four clicks, then play along. Use the pads or your keyboard. If every tap lands a bit early or late, nudge the tap offset.'),
  );

  els = { grooveName, staffHost, overlay, results, startBtn, pads, settings, tempo };
  selectGroove(S.sel);
  ro = new ResizeObserver(() => renderStaff());
  ro.observe(staffHost);

  onKey = (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, [role="dialog"]')) return;
    const k = usedInstruments(groove()).find((x) => x.key === e.key.toLowerCase());
    if (!k) return;
    e.preventDefault();
    hit(k.id, e.timeStamp, els.pads.querySelector(`[data-id="${k.id}"]`));
  };
  window.addEventListener('keydown', onKey);
}

export function unmount() {
  window.removeEventListener('keydown', onKey);
  ro?.disconnect();
  transport.stop();
}

const fmtOffset = (v) => (v === 0 ? '0 ms' : `${v > 0 ? '+' : '−'}${Math.abs(v)} ms`);
const groove = () => S.options.find((o) => o.key === S.sel).groove;
const isRandom = (key = S.sel) => key.startsWith('r');

/** Swap in a fresh random groove for the current sight-reading level. */
function newRandom() {
  if (S.phase === 'countin' || S.phase === 'running') return;
  const opt = S.options.find((o) => o.key === S.sel);
  opt.groove = randomGroove(opt.level);
  const saved = store.get('play.rand', {});
  saved[opt.level] = opt.groove;
  store.set('play.rand', saved);
  selectGroove(S.sel);
}

function selectGroove(key, fresh) {
  S.sel = key;
  store.set('play.sel', key);
  if (fresh && isRandom(key)) return newRandom();
  const opt = S.options.find((o) => o.key === key);
  els.grooveName.textContent = opt.name;
  navRef.set(isRandom(key) ? { right: { label: 'New groove', onClick: newRandom } } : {});
  S.colors = {};
  els.results.hidden = true;
  S.phase = 'idle';
  renderStaff();
  renderPads();
  updateControls();
}

function openPicker() {
  if (S.phase === 'countin' || S.phase === 'running') return;
  sheet({
    title: 'Choose a groove',
    items: S.options.map((o) => ({
      label: o.name,
      detail: o.key === 'my' && isEmpty(o.groove) ? 'Empty — add notes in Build' : o.detail,
      checked: o.key === S.sel,
      onClick: () => selectGroove(o.key, true),
    })),
  });
}

function renderStaff() {
  staff = renderPattern(els.staffHost, { pattern: groove().pattern, colors: S.colors });
}

function renderPads() {
  const used = usedInstruments(groove());
  els.pads.replaceChildren(
    ...used.map((k, i) => {
      const wide = i === used.length - 1 && used.length % 2 === 1;
      return h('button', {
        type: 'button',
        class: `pad ${k.family}${wide ? ' wide' : ''}`,
        'data-id': k.id,
        onPointerdown: (e) => {
          e.preventDefault();
          hit(k.id, e.timeStamp, e.currentTarget);
        },
      },
      h('span', { class: 'pad-name' }, k.name),
      h('span', { class: 'pad-key' }, k.keyLabel || k.key.toUpperCase()));
    }),
  );
  if (!used.length) els.pads.append(h('p', { class: 'empty' }, 'This groove is empty. Add some notes in Build first.'));
}

function updateControls() {
  const active = S.phase === 'countin' || S.phase === 'running';
  els.startBtn.textContent = active ? 'Stop' : S.phase === 'results' ? 'Try again' : 'Start';
  els.startBtn.classList.toggle('stop', active);
  els.startBtn.disabled = isEmpty(groove());
  els.settings.classList.toggle('locked', active);
  els.tempo.classList.toggle('locked', active);
}

function flash(pad, kind) {
  if (!pad) return;
  pad.classList.remove('hit', 'good', 'ok', 'bad');
  void pad.offsetWidth; // restart the animation
  pad.classList.add('hit');
  if (kind) pad.classList.add(kind);
  pad.addEventListener('animationend', () => pad.classList.remove('hit', 'good', 'ok', 'bad'), { once: true });
}

function hit(id, ts, pad) {
  playInstrument(id);
  if (S.phase !== 'countin' && S.phase !== 'running') {
    flash(pad);
    return;
  }
  const t = audioTimeAt(ts) - S.offset / 1000;
  const windowSec = Math.min(0.15, S.sixteenth * 0.5 * nearestGap(groove().pattern, id));
  let best = null;
  let bestD = Infinity;
  for (const e of S.expected) {
    if (e.id !== id || e.hit) continue;
    const d = t - e.time;
    if (Math.abs(d) <= windowSec && Math.abs(d) < Math.abs(bestD)) {
      best = e;
      bestD = d;
    }
  }
  if (best) {
    best.hit = true;
    best.d = bestD;
    flash(pad, Math.abs(bestD) <= ON_TIME ? 'good' : 'ok');
  } else {
    S.extras++;
    flash(pad, 'bad');
  }
}

function start() {
  const g = groove();
  if (isEmpty(g)) {
    toast('This groove is empty — add notes in Build');
    return;
  }
  S.phase = 'countin';
  S.colors = {};
  S.extras = 0;
  els.results.hidden = true;
  renderStaff();
  updateControls();

  transport.start({
    getBpm: () => S.bpm,
    getPattern: () => g.pattern,
    loops: S.loops,
    countInBeats: 4,
    playGroove: S.hear,
    metronome: true,
    onEvent,
  });
  S.sixteenth = transport.sixteenth;
  S.expected = [];
  for (let loop = 0; loop < S.loops; loop++) {
    for (let slot = 0; slot < 16; slot++) {
      for (const k of KIT) {
        if (g.pattern[k.id][slot]) {
          S.expected.push({ id: k.id, slot, loop, time: transport.startTime + (loop * 16 + slotPos(g.pattern, slot)) * S.sixteenth, hit: false, d: 0 });
        }
      }
    }
  }
}

function onEvent(ev) {
  if (ev.type === 'count') {
    els.overlay.textContent = ev.n;
    els.overlay.classList.remove('pop');
    void els.overlay.offsetWidth;
    els.overlay.classList.add('pop', 'show');
  } else if (ev.type === 'step') {
    if (S.phase === 'countin') {
      S.phase = 'running';
      els.overlay.classList.remove('show');
    }
    staff.setPlayhead(ev.slot);
  } else if (ev.type === 'end') {
    // Give the last notes a moment to be tapped before scoring.
    setTimeout(finish, 160);
  }
}

function stop(userStopped) {
  transport.stop();
  S.phase = 'idle';
  els.overlay.classList.remove('show');
  staff?.setPlayhead(null);
  updateControls();
  if (userStopped) toast('Stopped');
}

function finish() {
  if (S.phase !== 'running') return;
  S.phase = 'results';
  staff.setPlayhead(null);

  let on = 0, early = 0, late = 0, missed = 0, sum = 0, hits = 0;
  const byNote = {};
  for (const e of S.expected) {
    const key = `${e.id}:${e.slot}`;
    const worst = byNote[key] || 'on';
    let grade;
    if (!e.hit) {
      missed++;
      grade = 'miss';
    } else {
      hits++;
      sum += e.d;
      if (Math.abs(e.d) <= ON_TIME) {
        on++;
        grade = 'on';
      } else {
        grade = 'off';
        if (e.d < 0) early++;
        else late++;
      }
    }
    const rank = { on: 0, off: 1, miss: 2 };
    byNote[key] = rank[grade] > rank[worst] ? grade : worst;
  }
  const total = S.expected.length;
  const score = Math.max(0, Math.round((100 * (on + 0.5 * (early + late) - 0.25 * S.extras)) / total));
  const colorFor = { on: 'var(--green)', off: 'var(--orange)', miss: 'var(--red)' };
  S.colors = Object.fromEntries(Object.entries(byNote).map(([k, v]) => [k, colorFor[v]]));
  renderStaff();

  const mean = hits ? (sum / hits) * 1000 : 0;
  const tendency = hits < 3 ? ''
    : mean < -15 ? `You’re rushing a little — about ${Math.round(-mean)} ms ahead of the beat on average.`
    : mean > 15 ? `You’re dragging a little — about ${Math.round(mean)} ms behind the beat on average.`
    : 'Nicely centered on the beat.';

  const bestAll = store.get('play.best', {});
  const name = S.options.find((o) => o.key === S.sel).name;
  const isBest = S.sel !== 'my' && !isRandom() && score > (bestAll[name] || 0);
  if (isBest) {
    bestAll[name] = score;
    store.set('play.best', bestAll);
  }

  const stat = (n, label, cls) => h('div', { class: `stat ${cls}` }, h('div', { class: 'stat-n' }, n), h('div', { class: 'stat-l' }, label));
  els.results.replaceChildren(
    h('div', { class: 'results-head' },
      h('div', { class: 'big-score' }, `${score}`, h('span', null, '%')),
      h('div', { class: 'results-msg' },
        h('div', { class: 'results-title' }, score >= 90 ? 'Excellent!' : score >= 70 ? 'Solid.' : score >= 40 ? 'Getting there.' : 'Try it slower.'),
        h('div', { class: 'results-sub' }, isBest ? 'New personal best' : `${S.bpm} BPM`))),
    h('div', { class: 'stats' },
      stat(on, 'On time', 'on'),
      stat(early, 'Early', 'off'),
      stat(late, 'Late', 'off'),
      stat(missed, 'Missed', 'miss')),
    tendency && h('p', { class: 'tendency' }, tendency),
    S.extras ? h('p', { class: 'tendency' }, `${S.extras} extra tap${S.extras === 1 ? '' : 's'} that didn’t match a note.`) : '',
    h('div', { class: 'legend' },
      h('span', { class: 'on' }, 'On time'),
      h('span', { class: 'off' }, 'Early / late'),
      h('span', { class: 'miss' }, 'Missed')),
  );
  els.results.hidden = false;
  updateControls();
}
