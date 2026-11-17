// Play: tap along to written grooves and get per-note timing feedback.
// Sight-reading options deal a new random groove each time.
import { h, stepper, toggle, row, sheet, toast, svgIcon, ICONS } from '../ui.js';
import { PRESETS, LEVEL_NAMES, STYLES, makeGroove, randomGroove, randomChart, randomLongChart, normalizeGroove, normalizeChart, chartOrder, usedInstruments, chartInstruments, subdivisionLabel, countInFor } from '../grooves.js';
import { renderPattern, renderChart } from '../notation.js';
import { transport, playInstrument } from '../audio.js';
import { store } from '../store.js';
import { tapSession, padButtons, keyHandler, kitHandler, micHandler, flash, resultDetails } from '../tap.js';
import { openSettings } from '../settings.js';
import { logPractice } from '../progress.js';
import { loadMyGroove, loadMyChart } from './build.js';
import { loadLibrary, asChart } from '../library.js';

export const title = 'Play';

let S = null;
let els = null;
let staff = null;
let ro = null;
let onKey = null;
let offKit = null;
let offMic = null;
let navRef = null;

function grooveOptions() {
  const saved = store.get('play.rand', {});
  const randOpt = (key, gen, name, detail) => ({ key, gen, name, detail, groove: normalizeGroove(saved[gen]) || randomGroove(gen) });
  // A chart is several bars; `groove` holds its first bar for the checks that only need one.
  const chartOpt = (key, gen, repeat, name, detail, long = false) => {
    const chart = normalizeChart(saved[`chart:${key}`]) || newChart({ gen, repeat, long });
    return { key, gen, repeat, long, chart, name, detail, groove: { name: chart.name, pattern: chart.bars[0] } };
  };
  const mine = loadMyChart();
  return [
    mine
      ? { key: 'my', name: 'My groove', detail: `From the Build tab · ${mine.bars.length} bars`, chart: mine, groove: { name: mine.name, pattern: mine.bars[0] } }
      : { key: 'my', name: 'My groove', detail: 'From the Build tab', groove: loadMyGroove() },
    ...loadLibrary().map((e) => {
      const base = { key: `lib:${e.id}`, name: e.name, detail: `Saved groove · ${e.bars.length} bar${e.bars.length === 1 ? '' : 's'}`, groove: { name: e.name, pattern: e.bars[0] } };
      return e.bars.length > 1 ? { ...base, chart: asChart(e) } : base;
    }),
    ...LEVEL_NAMES.map((lv, i) => chartOpt(`c${i}`, i, false, `4-bar chart · ${lv}`, 'Four bars ending in a fill')),
    ...LEVEL_NAMES.map((lv, i) => chartOpt(`e${i}`, i, true, `Repeat chart · ${lv}`, 'Eight bars: a repeat with two endings')),
    ...LEVEL_NAMES.map((lv, i) => chartOpt(`L${i}`, i, false, `16-bar chart · ${lv}`, 'Four phrases, each ending in a fill', true)),
    ...STYLES.map((st) => chartOpt(`cs:${st.id}`, st.id, false, `4-bar chart · ${st.name}`, 'Four bars ending in a fill')),
    ...LEVEL_NAMES.map((lv, i) => randOpt(`r${i}`, i, `Sight-read · ${lv}`, 'A new groove every time')),
    ...STYLES.map((st) => randOpt(`s:${st.id}`, st.id, `Sight-read · ${st.name}`, 'A new groove every time')),
    ...PRESETS.map((p, i) => {
      const groove = makeGroove(p.name, p.spec);
      return { key: `p${i}`, name: p.name, detail: `${p.level} · ${subdivisionLabel(groove)}`, groove };
    }),
  ];
}

/** A fresh random chart for a chart option. */
const newChart = ({ gen, repeat, long }) => (long ? randomLongChart(gen) : randomChart(gen, { repeat }));

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
    trainer: store.get('play.trainer', false),
    phase: 'idle', // idle | countin | running | results
    session: null,
    colors: {},
  };

  const grooveName = h('span', { class: 'row-value' });
  const staffHost = h('div', { class: 'staff-host' });
  const overlay = h('div', { class: 'count-overlay', 'aria-hidden': 'true' });
  const results = h('div', { class: 'results', hidden: true, 'aria-live': 'polite' });
  const startBtn = h('button', { type: 'button', class: 'btn-primary start', onClick: () => (active() ? stop(true) : start()) });
  const nextBtn = h('button', { type: 'button', class: 'btn-primary', hidden: true, onClick: newRandom }, 'Next groove');
  const bpmVal = h('span', { class: 'tempo-val' }, S.bpm);
  const loopsVal = h('span', { class: 'row-value' }, S.loops);
  const pads = h('div', { class: 'pads' });

  const settings = h('div', { class: 'list' },
    row('Hear the groove', toggle(S.hear, (v) => {
      S.hear = v;
      store.set('play.hear', v);
    }, 'Hear the groove')),
    row(['Tempo trainer', h('span', { class: 'row-sub' }, `Speeds up ${TRAIN_STEP} BPM each time you score ${TRAIN_PASS}% or more`)], toggle(S.trainer, (v) => {
      S.trainer = v;
      store.set('play.trainer', v);
    }, 'Tempo trainer')),
    row('Times through', loopsVal, stepper({
      value: S.loops, min: 1, max: 8, label: 'times through',
      onChange: (v) => {
        S.loops = v;
        loopsVal.textContent = v;
        store.set('play.loops', v);
      },
    })),
    h('button', { type: 'button', class: 'row row-btn', onClick: openSettings },
      h('span', { class: 'row-main' }, h('span', null, 'Sound, kit and timing'), h('span', { class: 'row-sub' }, 'Volume, drum kit, microphone and calibration, in Settings')),
      svgIcon(ICONS.chevron, 'icon chevron')),
  );

  const tempoStepper = stepper({
    value: S.bpm, min: BPM_MIN, max: BPM_MAX, step: 2, label: 'tempo',
    onChange: (v) => setBpm(v),
  });
  // Tap tempo: tap the button in time and the tempo follows the last few taps.
  let tapTimes = [];
  const tapBtn = h('button', {
    type: 'button', class: 'tap-tempo', 'aria-label': 'Tap tempo: tap in time to set the tempo',
    onPointerdown: (e) => {
      if (tapTimes.length && e.timeStamp - tapTimes[tapTimes.length - 1] > 2000) tapTimes = [];
      tapTimes.push(e.timeStamp);
      tapTimes = tapTimes.slice(-5);
      playInstrument('hihat');
      if (tapTimes.length < 2) return;
      const beat = (tapTimes[tapTimes.length - 1] - tapTimes[0]) / (tapTimes.length - 1);
      setBpm(Math.round(60000 / beat));
    },
  }, 'Tap');
  const tempo = h('div', { class: 'tempo' },
    h('div', { class: 'tempo-read' }, bpmVal, h('span', { class: 'tempo-unit' }, 'BPM')),
    tapBtn, tempoStepper);

  root.append(
    h('div', { class: 'list' },
      h('button', { type: 'button', class: 'row row-btn', onClick: openPicker },
        h('span', { class: 'row-main' }, 'Groove'), grooveName, svgIcon(ICONS.chevron, 'icon chevron'))),
    h('section', { class: 'card score' }, h('div', { class: 'staff-wrap' }, staffHost, overlay), results),
    h('div', { class: 'transport' }, startBtn, tempo),
    h('div', { class: 'next-row' }, nextBtn),
    pads,
    h('div', { class: 'section-label' }, 'This run'),
    settings,
    h('p', { class: 'footnote' },
      'You’ll hear a bar of clicks, then play along. Use the pads, your keyboard, an electronic drum kit, or a practice pad with the microphone. Connect a kit or microphone, and calibrate your timing, in Settings (the gear at the top).'),
  );

  els = { grooveName, staffHost, overlay, results, startBtn, nextBtn, pads, settings, tempo, bpmVal, tempoStepper };
  selectGroove(S.sel);
  ro = new ResizeObserver(() => renderStaff());
  ro.observe(staffHost);

  onKey = keyHandler(usedKits, hit, els.pads);
  window.addEventListener('keydown', onKey);
  offKit = kitHandler(usedKits, hit, els.pads);
  offMic = micHandler(active, () => S.session, els.pads);
}

export function unmount() {
  window.removeEventListener('keydown', onKey);
  offKit?.();
  offMic?.();
  ro?.disconnect();
  transport.stop();
}

const BPM_MIN = 40;
const BPM_MAX = 200;
const TRAIN_STEP = 4; // BPM the tempo trainer moves by
const TRAIN_PASS = 85; // score that earns a faster tempo
const TRAIN_FAIL = 50; // below this it slows down again

function setBpm(v) {
  S.bpm = Math.min(BPM_MAX, Math.max(BPM_MIN, v));
  els.bpmVal.textContent = S.bpm;
  els.tempoStepper.set(S.bpm);
  store.set('play.bpm', S.bpm);
}

/** Tempo trainer: move the tempo after a run and say what happened. */
function trainTempo(score) {
  if (!S.trainer) return '';
  if (score >= TRAIN_PASS) {
    if (S.bpm >= BPM_MAX) return 'Tempo trainer: you’re at the top speed.';
    setBpm(S.bpm + TRAIN_STEP);
    return `Tempo trainer: passed. The next run is at ${S.bpm} BPM.`;
  }
  if (score < TRAIN_FAIL && S.bpm > BPM_MIN) {
    setBpm(S.bpm - TRAIN_STEP);
    return `Tempo trainer: slowing to ${S.bpm} BPM. Get it clean, then speed up.`;
  }
  return `Tempo trainer: stay at ${S.bpm} BPM until you score ${TRAIN_PASS}%.`;
}

const active = () => S.phase === 'countin' || S.phase === 'running';
const option = (key = S.sel) => S.options.find((o) => o.key === key);
const groove = () => option().groove;
const isRandom = (key = S.sel) => option(key)?.gen != null;
/** The bars of the chosen chart, or null for a one-bar groove. */
const chartBars = () => option().chart?.bars || null;
const kitsOf = (o) => (o.chart ? chartInstruments(o.chart.bars) : usedInstruments(o.groove));
const usedKits = () => kitsOf(option());
const isEmpty = (o = option()) => kitsOf(o).length === 0;

/** Swap in a fresh random groove for the current sight-reading option. */
function newRandom() {
  if (active()) return;
  const opt = option();
  const saved = store.get('play.rand', {});
  if (opt.chart) {
    opt.chart = newChart(opt);
    opt.groove = { name: opt.chart.name, pattern: opt.chart.bars[0] };
    saved[`chart:${opt.key}`] = opt.chart;
  } else {
    opt.groove = randomGroove(opt.gen);
    saved[opt.gen] = opt.groove;
  }
  store.set('play.rand', saved);
  selectGroove(S.sel);
}

function selectGroove(key, fresh) {
  S.sel = key;
  store.set('play.sel', key);
  if (fresh && isRandom(key)) return newRandom();
  els.grooveName.textContent = option().name;
  navRef.set(isRandom(key) ? { right: { label: 'New groove', onClick: newRandom } } : {});
  S.colors = {};
  els.results.hidden = true;
  els.nextBtn.hidden = true;
  S.phase = 'idle';
  renderStaff();
  renderPads();
  updateControls();
}

function openPicker() {
  if (active()) return;
  sheet({
    title: 'Choose a groove',
    items: S.options.map((o) => ({
      label: o.name,
      detail: o.key === 'my' && isEmpty(o) ? 'Empty — add notes in Build' : o.detail,
      checked: o.key === S.sel,
      onClick: () => selectGroove(o.key, true),
    })),
  });
}

function renderStaff() {
  const bars = chartBars();
  staff = bars
    ? renderChart(els.staffHost, { bars, endings: option().chart.endings, colors: S.colors })
    : renderPattern(els.staffHost, { pattern: groove().pattern, colors: S.colors });
}

function renderPads() {
  const used = usedKits();
  els.pads.replaceChildren(...padButtons(used, hit));
  if (!used.length) els.pads.append(h('p', { class: 'empty' }, 'This groove is empty. Add some notes in Build first.'));
}

function updateControls() {
  els.startBtn.textContent = active() ? 'Stop' : S.phase === 'results' ? 'Try again' : 'Start';
  els.startBtn.classList.toggle('stop', active());
  els.startBtn.disabled = isEmpty();
  els.settings.classList.toggle('locked', active());
  els.tempo.classList.toggle('locked', active());
}

/** A tap on a pad or key, or (with `kit`) a hit on an electronic drum kit. */
function hit(id, ts, pad, kit) {
  if (!kit) playInstrument(id); // kit hits are sounded where they come in (see kitHandler)
  if (!active()) return flash(pad);
  flash(pad, S.session.hit(id, ts, kit ? 'midi' : 'tap', kit));
}

function start() {
  const g = groove();
  if (isEmpty()) {
    toast('This groove is empty — add notes in Build');
    return;
  }
  S.phase = 'countin';
  S.colors = {};
  els.results.hidden = true;
  els.nextBtn.hidden = true;
  renderStaff();
  updateControls();

  const bars = chartBars();
  const order = bars && chartOrder(option().chart);
  S.order = order;
  transport.start({
    getBpm: () => S.bpm,
    getPattern: bars ? (n) => bars[order[n % order.length]] : () => g.pattern,
    loops: S.loops * (order?.length || 1),
    countInBeats: countInFor(g.pattern),
    playGroove: S.hear,
    metronome: true,
    onEvent,
  });
  S.session = tapSession({
    pattern: g.pattern,
    bars,
    order,
    label: `Play · ${option().name} · ${S.bpm} BPM`,
    ids: usedKits().map((k) => k.id),
    loops: S.loops,
    startTime: transport.startTime,
    sixteenth: transport.sixteenth,
  });
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
    staff.setPlayhead(ev.slot, S.order ? S.order[ev.loop % S.order.length] : 0);
  } else if (ev.type === 'interrupt') {
    stop();
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
  const r = S.session.result();
  S.colors = r.colors;
  renderStaff();

  const bestAll = store.get('play.best', {});
  const name = option().name;
  const isBest = S.sel !== 'my' && !isRandom() && r.score > (bestAll[name] || 0);
  if (isBest) {
    bestAll[name] = r.score;
    store.set('play.best', bestAll);
  }
  const played = S.bpm;
  logPractice({ kind: isRandom() ? 'sight' : 'play', label: name, score: r.score, bpm: played });
  const trainer = trainTempo(r.score);

  els.results.replaceChildren(
    h('div', { class: 'results-head' },
      h('div', { class: 'big-score' }, `${r.score}`, h('span', null, '%')),
      h('div', { class: 'results-msg' },
        h('div', { class: 'results-title' }, r.score >= 90 ? 'Excellent!' : r.score >= 70 ? 'Solid.' : r.score >= 40 ? 'Getting there.' : 'Try it slower.'),
        h('div', { class: 'results-sub' }, isBest ? 'New personal best' : `${played} BPM`))),
    trainer && h('p', { class: 'trainer-note' }, trainer),
    ...resultDetails(r),
    h('div', { class: 'legend' },
      h('span', { class: 'on' }, 'On time'),
      h('span', { class: 'off' }, 'Early / late'),
      h('span', { class: 'miss' }, 'Missed')),
  );
  els.results.hidden = false;
  els.nextBtn.hidden = !isRandom();
  updateControls();
}
