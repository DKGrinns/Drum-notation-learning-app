// Tap-along scoring shared by Learn drills, Play and sight-reading.
//
// A session lists every note you're expected to tap (per loop), matches each tap
// to the nearest unplayed note of that drum, and grades the result.
// Tap times are corrected by the calibrated tap offset (see calibrate.js).
//
// Hits from an electronic drum kit also say how hard they were played and
// whether the hi-hat was open, so accents, ghost notes and open hi-hats can be
// checked too. That is reported next to the timing score, not folded into it.
import { h } from './ui.js';
import { KIT } from './kit.js';
import { barSlots, barLength, slotPos, nearestGap, NOTE, isHit, allSlots, noteAt } from './grooves.js';
import { audioTimeAt, playInstrument } from './audio.js';
import { store } from './store.js';
import { midiOffset, midiSounds, onMidiHit } from './midi.js';
import { logRun, logEvent } from './diag.js';
import { micOffset, onMicHit } from './mic.js';

/** Seconds either side of a note that count as "on time". */
export const ON_TIME = 0.045;
/** The longest gap (seconds) between the two strokes of a flam. */
const FLAM_GAP = 0.12;
/** How many strokes a written note takes: a flam two, a drag three, a roll as many as you like. */
const STROKES = { [NOTE.FLAM]: 2, [NOTE.DRAG]: 3, [NOTE.ROLL]: Infinity };
/**
 * Two kit hits on one drum closer together than this (seconds) are one stroke that
 * the pad reported twice. Nobody plays that fast, except inside a flam, drag or roll.
 */
export const RETRIGGER = 0.03;

/** The calibrated tap offset in ms (positive: your taps register late). */
export const tapOffset = () => store.get('play.offset', 0);
export const setTapOffset = (ms) => {
  store.set('play.offset', ms);
  store.set('calibrated', true);
  logEvent('note', { text: `Tap timing set to ${ms} ms` });
};
export const isCalibrated = () => !!store.get('calibrated', false);
export const fmtOffset = (v) => (v === 0 ? '0 ms' : `${v > 0 ? '+' : '−'}${Math.abs(v)} ms`);

/**
 * Pass `pattern` for one looped bar, or `bars` for a chart of several bars (played
 * through `loops` times). With bars, result colors are keyed 'bar:drum:slot'.
 * `order` lists the bar numbers in the order they are played (for repeats).
 * toAudioTime turns an event timestamp into audio time (swapped out in tests).
 * label names the exercise in a diagnostics recording.
 * @param {{pattern?, bars?: object[], order?: number[], ids: string[], loops: number, startTime: number, sixteenth: number, label?: string}} o
 */
export function tapSession({ pattern, bars, order, ids, loops, startTime, sixteenth, toAudioTime = audioTimeAt, label = '' }) {
  const seq = bars || [pattern];
  const ord = (bars && order) || seq.map((_, i) => i);
  const len = barSlots(seq[0]);
  const barLen = barLength(seq[0]); // how long a bar lasts, in 16ths
  const expected = [];
  for (let n = 0; n < loops * ord.length; n++) {
    const bar = ord[n % ord.length];
    const p = seq[bar];
    for (const slot of allSlots(p)) {
      for (const id of ids) {
        if (isHit(noteAt(p, id, slot))) {
          expected.push({ id, slot, bar, n, value: noteAt(p, id, slot), time: startTime + (n * barLen + slotPos(p, slot)) * sixteenth, hit: false, d: 0 });
        }
      }
    }
  }
  // How close together each drum's notes get, which sets how wide a tap's window can be.
  const gap = Object.fromEntries(ids.map((id) => [id, Math.min(...seq.map((p) => nearestGap(p, id)))]));
  const S = { expected, extras: 0 };
  const taps = []; // every tap as it came in, for diagnostics
  const lastHit = {}; // per drum: the last hit, to spot a pad reporting one stroke twice
  logEvent('note', { text: `Run started: ${label || '(no label)'}`, startTime: Math.round(startTime * 1e4) / 1e4 });

  /**
   * Judge a tap (event timeStamp). A kit hit (source 'midi') has its own timing
   * correction, and `info` ({ velocity, open }) says how it was played.
   * Returns 'good', 'ok' or 'bad'.
   */
  S.hit = (id, ts, source, info) => {
    const t = toAudioTime(ts) - (source === 'midi' ? midiOffset() : source === 'mic' ? micOffset() : tapOffset()) / 1000;
    const round = (x) => Math.round(x * 1e4) / 1e4;
    // A pad that fires twice for one stroke: count it once, at the strength of the harder of the two.
    const prev = lastHit[id];
    if (source === 'midi' && prev && t >= prev.t && t - prev.t <= RETRIGGER && !(prev.e && STROKES[prev.e.value])) {
      taps.push({ id, t: round(t), src: source, vel: info?.velocity, open: info?.open || undefined, note: info?.note, d: null, dup: true });
      if (prev.e && info?.velocity > (prev.e.vel || 0)) {
        prev.e.vel = info.velocity;
        prev.e.open = !!info.open;
        prev.e.note = info.note;
      }
      return prev.kind;
    }
    const seen = (e, kind) => {
      lastHit[id] = { t, e, kind };
      return kind;
    };
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
    // A flam is written as one note but played as two strokes almost together. The
    // second stroke is the main one, so it sets the timing; it isn't an extra hit.
    // The same goes for the extra strokes of a drag. A roll takes any number of strokes for a beat.
    const flam = best ? null : expected.find((e) => e.id === id && e.hit && e.strokes < (STROKES[e.value] || 1) && t > e.t1
      && (e.value === NOTE.ROLL ? t - e.time <= sixteenth * 4 : t - e.t1 <= FLAM_GAP * (STROKES[e.value] - 1) && Math.abs(t - e.time) <= win));
    // t is the corrected time, so a recording can be replayed without knowing the offsets.
    taps.push({ id, t: round(t), src: source || 'tap', vel: info?.velocity, open: info?.open || undefined, note: info?.note, d: best ? round(bestD) : flam ? round(t - flam.time) : null });
    if (flam) {
      flam.strokes++;
      if (flam.value === NOTE.ROLL) return seen(flam, 'good'); // a roll starts on the beat: its first stroke set the timing
      flam.d = t - flam.time;
      if (source === 'midi' && info?.velocity) {
        flam.graceVel = flam.vel;
        flam.vel = info.velocity;
      }
      return seen(flam, Math.abs(flam.d) <= ON_TIME ? 'good' : 'ok');
    }
    if (!best) {
      S.extras++;
      return seen(null, 'bad');
    }
    best.hit = true;
    best.d = bestD;
    best.t1 = t;
    best.strokes = 1;
    if (source === 'midi' && info?.velocity) {
      best.vel = info.velocity;
      best.open = !!info.open;
      best.note = info.note;
    }
    return seen(best, Math.abs(bestD) <= ON_TIME ? 'good' : 'ok');
  };

  // The closest that two notes at different moments get, on any drum.
  const times = [...new Set(expected.map((e) => e.time))].sort((a, b) => a - b);
  const tightest = times.reduce((m, x, i) => (i ? Math.min(m, x - times[i - 1]) : m), Infinity);

  /**
   * Judge a hit that could be any drum (a microphone can't tell which). It plays
   * whatever is due: every note written at that moment counts as hit.
   */
  S.hitAny = (ts, source = 'mic') => {
    const t = toAudioTime(ts) - (source === 'mic' ? micOffset() : tapOffset()) / 1000;
    const win = Math.min(0.15, tightest * 0.5);
    let best = null;
    for (const e of expected) {
      if (!e.hit && Math.abs(t - e.time) <= win && (!best || Math.abs(t - e.time) < Math.abs(t - best.time))) best = e;
    }
    const round = (x) => Math.round(x * 1e4) / 1e4;
    taps.push({ id: 'any', t: round(t), src: source, d: best ? round(t - best.time) : null });
    if (!best) {
      // The extra strokes of a flam, drag or roll that has already started are part of that note.
      const more = expected.find((e) => e.hit && e.strokes < (STROKES[e.value] || 1) && t > e.t1
        && t - e.time <= (e.value === NOTE.ROLL ? sixteenth * 4 : FLAM_GAP * 2));
      if (more) {
        more.strokes++;
        return 'good';
      }
      S.extras++;
      return 'bad';
    }
    const d = t - best.time;
    for (const e of expected) {
      if (e.hit || e.time !== best.time) continue;
      e.hit = true;
      e.d = d;
      e.t1 = t;
      e.strokes = 1;
    }
    return Math.abs(d) <= ON_TIME ? 'good' : 'ok';
  };

  /**
   * How the kit hits were played: for each kind of note, how many were right.
   * Loud and soft are judged against your own normal notes on the same drum, so
   * it doesn't matter how hard you play overall. null without kit hits.
   */
  const expression = () => {
    const played = expected.filter((e) => e.vel);
    if (!played.length) return null;
    const normal = {};
    for (const id of ids) {
      const v = played.filter((e) => e.id === id && e.value === NOTE.HIT).map((e) => e.vel).sort((a, b) => a - b);
      if (v.length >= 2) normal[id] = v[v.length >> 1];
    }
    const tally = (list, ok) => (list.length ? { ok: list.filter(ok).length, total: list.length } : null);
    const of = (value) => played.filter((e) => e.value === value);
    const hats = played.filter((e) => e.id === 'hihat');
    const hasOpen = hats.some((e) => e.value === NOTE.OPEN);
    const out = {
      accents: tally(of(NOTE.ACCENT), (e) => e.vel >= 120 || (normal[e.id] ? e.vel >= normal[e.id] * 1.15 : e.vel >= 95)),
      ghosts: tally(of(NOTE.GHOST), (e) => (normal[e.id] ? e.vel <= normal[e.id] * 0.6 : e.vel <= 45)),
      opens: tally(of(NOTE.OPEN), (e) => e.open),
      flams: tally(of(NOTE.FLAM), (e) => e.strokes >= 2),
      drags: tally(of(NOTE.DRAG), (e) => e.strokes >= 3),
      rolls: tally(of(NOTE.ROLL), (e) => e.strokes >= 3),
      rims: tally(of(NOTE.RIM), (e) => e.note === 40),
      // These two are told apart by which note the kit sends (37 and 53 on Roland and General MIDI kits).
      crosses: tally(of(NOTE.CROSS), (e) => e.note === 37),
      bells: tally(of(NOTE.BELL), (e) => e.note === 53),
      // Closed hi-hats only matter in music that also has open ones.
      closed: hasOpen ? tally(hats.filter((e) => e.value !== NOTE.OPEN), (e) => !e.open) : null,
    };
    return Object.values(out).some(Boolean) ? out : null;
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
    const result = {
      score, on, early, late, missed, hits, extras: S.extras, mean: hits ? (sum / hits) * 1000 : 0, colors, expression: expression(),
      tips: insights(expected, { chart: ord.length > 1, loops }),
    };
    logRun({
      label, ids, loops, startTime, sixteenth,
      bars: bars || [pattern], order: (bars && order) || null, single: !bars,
      taps,
      result: { score, on, early, late, missed, extras: S.extras, mean: Math.round(result.mean), expression: result.expression },
    });
    return result;
  };
  /** The run was given up before the end (noted for diagnostics; nothing is scored). */
  S.abandon = () => logEvent('note', { text: `Run stopped early: ${label || '(no label)'}`, taps: taps.length });
  return S;
}

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const nth = (n) => ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'][n] || `${n + 1}th`;

/**
 * What went wrong, in plain words: up to three sentences picked from the scored
 * notes. Each expected note has { id, bar, n (which bar of the run it is in), hit, d }.
 * chart: the music has more than one bar. loops: how many times through.
 */
export function insights(expected, { chart = false, loops = 1 } = {}) {
  const tips = [];
  if (!expected.length) return tips;
  const hit = expected.filter((e) => e.hit);
  const byBar = [];
  for (const e of expected) (byBar[e.n] ||= []).push(e);
  const missedIn = (list) => list.filter((e) => !e.hit).length;

  // 1. Came in late: nothing in the first bar, but playing after it.
  let from = 0;
  if (byBar.length >= 2 && missedIn(byBar[0]) === byBar[0].length && hit.length >= 3) {
    from = 1;
    tips.push(chart
      ? 'You came in a bar late: nothing was played in the first bar. Start on the first beat after the count-in.'
      : 'You came in late: nothing was played the first time through. Start on the first beat after the count-in.');
  }

  // 2. Where a chart fell apart: the bar with the largest share of its notes missed (at least half).
  const rest = expected.filter((e) => e.n >= from);
  const lost = missedIn(rest) / (rest.length || 1);
  if (chart && lost < 0.6) {
    let worst = null;
    for (let n = from; n < byBar.length; n++) {
      const list = byBar[n] || [];
      const m = missedIn(list);
      if (list.length >= 3 && m / list.length >= 0.5 && (!worst || m / list.length > worst.m / worst.total)) worst = { n, m, total: list.length, bar: list[0].bar };
    }
    if (worst) {
      const perPass = byBar.length / loops;
      const where = loops > 1 ? `Bar ${worst.bar + 1}, the ${nth(Math.floor(worst.n / perPass))} time through,` : `Bar ${worst.bar + 1}`;
      tips.push(`${where} is where it slipped: ${worst.m} of ${worst.total} notes missed. Practice that bar on its own.`);
    }
  }
  if (lost >= 0.6 && hit.length) tips.push('Most of the notes were missed. Try it at a slower tempo first.');

  // 3. One drum ahead of or behind the others.
  if (hit.length >= 8) {
    let odd = null;
    for (const id of new Set(hit.map((e) => e.id))) {
      const mine = hit.filter((e) => e.id === id).map((e) => e.d * 1000);
      const others = hit.filter((e) => e.id !== id).map((e) => e.d * 1000);
      if (mine.length < 4 || others.length < 4) continue;
      const gap = mean(mine) - mean(others);
      if (Math.abs(gap) >= 20 && (!odd || Math.abs(gap) > Math.abs(odd.gap))) odd = { id, gap };
    }
    if (odd) {
      const name = (KIT.find((k) => k.id === odd.id)?.name || odd.id).toLowerCase();
      tips.push(`Your ${name} lands about ${Math.round(Math.abs(odd.gap))} ms ${odd.gap < 0 ? 'ahead of' : 'behind'} your other drums. Listen for them landing together.`);
    }
  }
  return tips.slice(0, 3);
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

/**
 * Listen for hits from an electronic drum kit, for the drums in play.
 * onHit gets the kit hit as a fourth argument. Returns a function that stops listening.
 */
export function kitHandler(getKits, onHit, padsEl) {
  return onMidiHit((hit) => {
    // Sound every drum you hit, harder hits louder, even ones this exercise doesn't use.
    if (midiSounds()) playInstrument(hit.open ? 'hihatOpen' : hit.id, undefined, 0.35 + 0.65 * (hit.velocity / 127));
    const k = getKits().find((x) => x.id === hit.id);
    if (!k) return; // a drum this exercise doesn't use: let it pass
    onHit(k.id, hit.ts, padsEl.querySelector(`[data-id="${k.id}"]`), hit);
  });
}

/**
 * Listen for hits heard by the microphone while `isActive()` is true. Each one
 * goes to getSession().hitAny and flashes every pad. Returns a function that stops listening.
 */
export function micHandler(isActive, getSession, padsEl) {
  return onMicHit((m) => {
    if (!isActive()) return;
    const kind = getSession().hitAny(m.ts, 'mic');
    for (const pad of padsEl.querySelectorAll('.pad')) flash(pad, kind);
  });
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
    (r.tips || []).map((t) => h('p', { class: 'tendency' }, t)),
    r.expression ? expressionDetails(r.expression) : '',
  ];
}

/** "From your kit": accents, ghost notes and hi-hat openings that came out right. */
function expressionDetails(x) {
  const parts = [
    ['Accents', x.accents, 'Play accents clearly louder than the notes around them.'],
    ['Ghost notes', x.ghosts, 'Play ghost notes much softer, with the stick close to the head.'],
    ['Open hi-hat', x.opens, 'Lift your foot for the notes with a circle above them.'],
    ['Closed hi-hat', x.closed, 'Keep the hi-hat closed except where a circle is written.'],
    ['Flams', x.flams, 'Play a flam as two strokes almost together: a soft one just before the main one.'],
    ['Drags', x.drags, 'A drag is three strokes: two quick soft ones, then the main note.'],
    ['Rolls', x.rolls, 'Keep a roll going for the whole note: let the sticks bounce.'],
    ['Rimshots', x.rims, 'For a rimshot, hit the head and the rim at the same moment.'],
    ['Cross-stick', x.crosses, 'For a cross-stick, lay the stick across the snare and tap the rim with it.'],
    ['Ride bell', x.bells, 'Play the bell: the raised dome in the middle of the ride.'],
  ].filter((p) => p[1]);
  const weak = parts.find(([, t]) => t.ok / t.total < 0.7);
  return h('div', { class: 'expression' },
    h('div', { class: 'expression-title' }, 'From your kit'),
    h('div', { class: 'expression-row' }, parts.map(([name, t]) =>
      h('span', { class: `expression-chip${t.ok === t.total ? ' good' : t.ok / t.total < 0.7 ? ' low' : ''}` }, `${name} ${t.ok}/${t.total}`))),
    weak ? h('p', { class: 'tendency' }, weak[2]) : '');
}

export const kitsFor = (ids) => KIT.filter((k) => ids.includes(k.id));
