// Tap-along scoring shared by Learn drills, Play and sight-reading.
//
// A session lists every note you're expected to tap (per loop), matches each tap
// to the nearest unplayed note of that drum, and grades the result.
// Tap times are corrected by the calibrated tap offset (see calibrate.js).
import { h } from './ui.js';
import { KIT } from './kit.js';
import { barSlots, slotPos, nearestGap } from './grooves.js';
import { audioTimeAt } from './audio.js';
import { store } from './store.js';

/** Seconds either side of a note that count as "on time". */
export const ON_TIME = 0.045;

/** The calibrated tap offset in ms (positive: your taps register late). */
export const tapOffset = () => store.get('play.offset', 0);
export const setTapOffset = (ms) => {
  store.set('play.offset', ms);
  store.set('calibrated', true);
};
export const isCalibrated = () => !!store.get('calibrated', false);
export const fmtOffset = (v) => (v === 0 ? '0 ms' : `${v > 0 ? '+' : '−'}${Math.abs(v)} ms`);

/**
 * Pass `pattern` for one looped bar, or `bars` for a chart of several bars (played
 * through `loops` times). With bars, result colors are keyed 'bar:drum:slot'.
 * @param {{pattern?, bars?: object[], ids: string[], loops: number, startTime: number, sixteenth: number}} o
 */
export function tapSession({ pattern, bars, ids, loops, startTime, sixteenth }) {
  const seq = bars || [pattern];
  const len = barSlots(seq[0]);
  const expected = [];
  for (let n = 0; n < loops * seq.length; n++) {
    const bar = n % seq.length;
    const p = seq[bar];
    for (let slot = 0; slot < len; slot++) {
      for (const id of ids) {
        if (p[id][slot]) {
          expected.push({ id, slot, bar, time: startTime + (n * len + slotPos(p, slot)) * sixteenth, hit: false, d: 0 });
        }
      }
    }
  }
  // How close together each drum's notes get, which sets how wide a tap's window can be.
  const gap = Object.fromEntries(ids.map((id) => [id, Math.min(...seq.map((p) => nearestGap(p, id)))]));
  const S = { expected, extras: 0 };

  /** Judge a tap (event timeStamp). Returns 'good', 'ok' or 'bad'. */
  S.hit = (id, ts) => {
    const t = audioTimeAt(ts) - tapOffset() / 1000;
    const win = Math.min(0.15, sixteenth * 0.5 * (gap[id] ?? 4));
    let best = null;
    let bestD = Infinity;
    for (const e of expected) {
      if (e.id !== id || e.hit) continue;
      const d = t - e.time;
      if (Math.abs(d) <= win && Math.abs(d) < Math.abs(bestD)) {
        best = e;
        bestD = d;
      }
    }
    if (!best) {
      S.extras++;
      return 'bad';
    }
    best.hit = true;
    best.d = bestD;
    return Math.abs(bestD) <= ON_TIME ? 'good' : 'ok';
  };

  /** Grade everything: counts, score (0–100), mean offset (ms) and a color per note. */
  S.result = () => {
    let on = 0, early = 0, late = 0, missed = 0, sum = 0, hits = 0;
    const byNote = {};
    const rank = { on: 0, off: 1, miss: 2 };
    for (const e of expected) {
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
      const k = bars ? `${e.bar}:${e.id}:${e.slot}` : `${e.id}:${e.slot}`;
      if (!byNote[k] || rank[grade] > rank[byNote[k]]) byNote[k] = grade;
    }
    const total = expected.length || 1;
    const score = Math.max(0, Math.round((100 * (on + 0.5 * (early + late) - 0.25 * S.extras)) / total));
    const colorFor = { on: 'var(--green)', off: 'var(--orange)', miss: 'var(--red)' };
    const colors = Object.fromEntries(Object.entries(byNote).map(([k, v]) => [k, colorFor[v]]));
    return { score, on, early, late, missed, hits, extras: S.extras, mean: hits ? (sum / hits) * 1000 : 0, colors };
  };
  return S;
}

// ---------- Shared bits of the tap screens ----------

/** Pads for the given drums (2 per row; an odd last one spans the row). */
export function padButtons(kits, onHit) {
  return kits.map((k, i) => h('button', {
    type: 'button',
    class: `pad ${k.family}${i === kits.length - 1 && kits.length % 2 ? ' wide' : ''}`,
    'data-id': k.id,
    onPointerdown: (e) => {
      e.preventDefault();
      onHit(k.id, e.timeStamp, e.currentTarget);
    },
  }, h('span', { class: 'pad-name' }, k.name), h('span', { class: 'pad-key' }, k.keyLabel || k.key.toUpperCase())));
}

/** Keyboard handler that maps each drum's key to a tap. */
export function keyHandler(getKits, onHit, padsEl) {
  return (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, [role="dialog"]')) return;
    const k = getKits().find((x) => x.key === e.key.toLowerCase());
    if (!k) return;
    e.preventDefault();
    onHit(k.id, e.timeStamp, padsEl.querySelector(`[data-id="${k.id}"]`));
  };
}

export function flash(pad, kind) {
  if (!pad) return;
  pad.classList.remove('hit', 'good', 'ok', 'bad');
  void pad.offsetWidth; // restart the animation
  pad.classList.add('hit');
  if (kind) pad.classList.add(kind);
  pad.addEventListener('animationend', () => pad.classList.remove('hit', 'good', 'ok', 'bad'), { once: true });
}

/** The four stat tiles plus the timing tendency and extra-tap lines. */
export function resultDetails(r) {
  const stat = (n, label, cls) => h('div', { class: `stat ${cls}` }, h('div', { class: 'stat-n' }, n), h('div', { class: 'stat-l' }, label));
  const tendency = r.hits < 3 ? ''
    : r.mean < -15 ? `You’re rushing a little — about ${Math.round(-r.mean)} ms early on average.`
    : r.mean > 15 ? `You’re dragging a little — about ${Math.round(r.mean)} ms late on average.`
    : 'Nicely centered on the beat.';
  return [
    h('div', { class: 'stats' }, stat(r.on, 'On time', 'on'), stat(r.early, 'Early', 'off'), stat(r.late, 'Late', 'off'), stat(r.missed, 'Missed', 'miss')),
    tendency && h('p', { class: 'tendency' }, tendency),
    r.extras ? h('p', { class: 'tendency' }, `${r.extras} extra tap${r.extras === 1 ? '' : 's'} that didn’t match a note.`) : '',
  ];
}

export const kitsFor = (ids) => KIT.filter((k) => ids.includes(k.id));
