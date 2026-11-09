// SVG drum-notation renderer.
//
// Hands (cymbals, snare, toms) are written as the upper voice with stems up;
// the kick is the lower voice with stems down — the standard drum-set layout.
// Beats can be straight (16th grid) or triplets. Notes are spaced by length, or
// evenly in 'grid' layout so the staff lines up with the Build step grid.
import { KIT } from './kit.js';

/** Horizontal gutters shared with the step grid so columns line up exactly. */
export const LEFT = 56;
export const RIGHT = 12;

const NS = 'http://www.w3.org/2000/svg';
const UP_KIT = KIT.filter((k) => !k.foot);
const DOWN_KIT = KIT.filter((k) => k.foot);

function el(parent, tag, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  parent.appendChild(e);
  return e;
}

function geometry(s) {
  const top = s * 5.5; // y of the top staff line (step 8)
  return { top, yOf: (step) => top + ((8 - step) * s) / 2, height: top + 4 * s + s * 4.6 };
}

function makeSvg(host, width, height) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('class', 'notation');
  svg.setAttribute('role', 'img');
  host.replaceChildren(svg);
  return svg;
}

function drawStaffLines(g, x1, x2, yOf) {
  for (let st = 0; st <= 8; st += 2) el(g, 'line', { x1, x2, y1: yOf(st), y2: yOf(st), class: 'staff-line' });
}

function drawClef(g, x, yOf, s) {
  for (const dx of [0, s * 0.85]) {
    el(g, 'rect', { x: x + dx, y: yOf(6), width: s * 0.42, height: yOf(2) - yOf(6), fill: 'currentColor' });
  }
}

function drawTimeSig(g, x, yOf, s) {
  for (const st of [6, 2]) {
    const t = el(g, 'text', {
      x, y: yOf(st), class: 'timesig', 'font-size': s * 2.7,
      'text-anchor': 'middle', 'dominant-baseline': 'central',
    });
    t.textContent = '4';
  }
}

function drawLedgers(g, x, step, yOf, s) {
  const w = s * 0.95;
  for (let st = 10; st <= step; st += 2) el(g, 'line', { x1: x - w, x2: x + w, y1: yOf(st), y2: yOf(st), class: 'ledger' });
  for (let st = -2; st >= step; st -= 2) el(g, 'line', { x1: x - w, x2: x + w, y1: yOf(st), y2: yOf(st), class: 'ledger' });
}

/** open: 'half' or 'whole' for long notes (hollow heads; an x gets a circle round it). */
function drawHead(g, kind, x, y, s, color, extra = {}, open = null) {
  if (kind === 'x') {
    const r = s * 0.48;
    if (open) el(g, 'circle', { cx: x, cy: y, r: s * 0.82, fill: 'none', stroke: color, 'stroke-width': s * 0.13 });
    return el(g, 'path', {
      d: `M${x - r} ${y - r}L${x + r} ${y + r}M${x + r} ${y - r}L${x - r} ${y + r}`,
      stroke: color, 'stroke-width': s * 0.18, 'stroke-linecap': 'round', fill: 'none', ...extra,
    });
  }
  if (open === 'whole') {
    return el(g, 'ellipse', { cx: x, cy: y, rx: s * 0.72, ry: s * 0.44, fill: 'none', stroke: color, 'stroke-width': s * 0.24, ...extra });
  }
  if (open) {
    return el(g, 'ellipse', {
      cx: x, cy: y, rx: s * 0.55, ry: s * 0.34, transform: `rotate(-20 ${x} ${y})`,
      fill: 'none', stroke: color, 'stroke-width': s * 0.17, ...extra,
    });
  }
  return el(g, 'ellipse', {
    cx: x, cy: y, rx: s * 0.6, ry: s * 0.42, transform: `rotate(-20 ${x} ${y})`, fill: color, ...extra,
  });
}

function drawRest(g, dur, x, cy, s, dotted = false) {
  if (dotted) el(g, 'circle', { cx: x + 0.95 * s, cy: cy - 0.5 * s, r: s * 0.17, fill: 'currentColor' });
  const stroke = { fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  if (dur === 4) {
    el(g, 'path', {
      d: `M${x - 0.3 * s} ${cy - 1.5 * s} L${x + 0.35 * s} ${cy - 0.7 * s} L${x - 0.2 * s} ${cy + 0.05 * s} ` +
        `L${x + 0.35 * s} ${cy + 0.75 * s} C${x - 0.35 * s} ${cy + 0.45 * s} ${x - 0.5 * s} ${cy + 1.0 * s} ${x + 0.05 * s} ${cy + 1.5 * s}`,
      'stroke-width': s * 0.28, ...stroke,
    });
    return;
  }
  const flags = dur === 1 ? 2 : 1;
  const topX = x + 0.42 * s;
  const topY = cy - 0.75 * s;
  const len = 1.75 * s + (flags - 1) * 0.8 * s;
  el(g, 'line', { x1: topX, y1: topY, x2: topX - len * 0.3, y2: topY + len, 'stroke-width': s * 0.16, ...stroke });
  for (let f = 0; f < flags; f++) {
    const dy = f * 0.8 * s;
    const dx = -dy * 0.3;
    el(g, 'circle', { cx: x - 0.3 * s + dx, cy: cy - 0.55 * s + dy, r: s * 0.24, fill: 'currentColor' });
    el(g, 'path', {
      d: `M${x - 0.3 * s + dx} ${cy - 0.4 * s + dy} Q${x + 0.05 * s + dx} ${cy - 0.3 * s + dy} ${topX + dx} ${topY + dy}`,
      'stroke-width': s * 0.16, ...stroke,
    });
  }
}

function drawFlags(g, n, sx, endY, up, s) {
  const sg = up ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const y = endY + sg * i * 0.85 * s;
    el(g, 'path', {
      d: `M${sx} ${y} c ${0.1 * s} ${sg * 0.9 * s} ${1.1 * s} ${sg * 1.1 * s} ${0.85 * s} ${sg * 2.4 * s}`,
      fill: 'none', stroke: 'currentColor', 'stroke-width': s * 0.22, 'stroke-linecap': 'round',
    });
  }
}

// ---------- Rhythm analysis ----------
//
// Each voice is broken into beats. A beat holds its notes and the rest (if any)
// before its first note. Note values come from the gap to the next note:
//   straight beat (16th units): 1 = 16th, 2 = 8th, 3 = dotted 8th, 4 = quarter
//   triplet beat  (1/3-beat units): 1 = triplet 8th, 2 = triplet quarter
// With pattern.long, a note may instead last past its beat (dotted quarter, half,
// dotted half, whole); the beats it covers draw nothing.

const tripOf = (p, b) => !!p.trip?.[b];
const posOf = (p, slot) => (slot >> 2) * 4 + (tripOf(p, slot >> 2) ? ((slot & 3) * 4) / 3 : slot & 3);

function analyzeVoice(pattern, kit) {
  const ons = [];
  for (let slot = 0; slot < 16; slot++) {
    const insts = kit.filter((k) => pattern[k.id]?.[slot]);
    if (insts.length) ons.push({ slot, b: slot >> 2, j: slot & 3, pos: posOf(pattern, slot), insts });
  }

  // Long notes: the longest standard value that fits the silence after the note.
  const cover = [0, 0, 0, 0]; // 16ths at the start of each beat still sounding from an earlier note
  if (pattern.long) {
    ons.forEach((o, i) => {
      if (tripOf(pattern, o.b)) return;
      const p = o.pos;
      const gap = (ons[i + 1]?.pos ?? 16) - p;
      let v = 0;
      if (p === 0 && gap >= 16) v = 16;
      else if (p === 0 && gap >= 12) v = 12;
      else if (p % 4 === 0 && p <= 8 && gap >= 8) v = 8;
      else if (p % 2 === 0 && gap === 6) v = 6;
      if (!v) return;
      for (let b = o.b + 1; b * 4 < p + v; b++) if (tripOf(pattern, b)) return;
      o.long = v;
      for (let b = o.b + 1; b * 4 < p + v; b++) cover[b] = Math.min(4, p + v - b * 4);
    });
  }

  return [0, 1, 2, 3].map((b) => {
    const trip = tripOf(pattern, b);
    const units = trip ? 3 : 4;
    const start = cover[b];
    const notes = ons.filter((o) => o.b === b);
    const beat = { b, trip, covered: start >= 4, notes, rest: null };
    if (beat.covered) return beat;
    if (!notes.length) {
      if (start === 0) beat.rest = { pos: b * 4, units, whole: true };
      return beat;
    }
    const first = notes[0].j;
    if (first > start) beat.rest = { pos: b * 4 + (trip ? (start * 4) / 3 : start), units: first - start };
    notes.forEach((o, i) => {
      const dur = (i < notes.length - 1 ? notes[i + 1].j : units) - o.j;
      o.stem = true;
      if (o.long) {
        o.beams = 0;
        o.dot = o.long === 6 || o.long === 12;
        o.hollow = o.long >= 8;
        o.stem = o.long < 16;
      } else if (trip) {
        o.beams = dur === 1 ? 1 : 0;
      } else {
        o.beams = dur === 1 ? 2 : dur === 4 ? 0 : 1;
        o.dot = dur === 3;
      }
    });
    // A flagged note with no beamed neighbour gets a flag (and needs room for it).
    notes.forEach((o, i) => {
      o.flag = o.beams > 0 && !(notes[i - 1]?.beams > 0) && !(notes[i + 1]?.beams > 0);
    });
    return beat;
  });
}

// ---------- Horizontal layout ----------

/** Gap (px) between beats in the grid layout; the Build step grid uses the same value. */
export const BEAT_GAP = 8;

/**
 * Grid layout: four equal beats with a gap between them, each split into evenly
 * spaced columns, so the staff lines up with the step grid below it.
 */
function gridLayout(pattern, width, res) {
  const beatW = (width - LEFT - RIGHT - 3 * BEAT_GAP) / 4;
  const cols = (b) => (tripOf(pattern, b) ? 3 : 4 / res);
  const cell = (slot) => {
    const b = slot >> 2;
    const n = cols(b);
    const c = tripOf(pattern, b) ? slot & 3 : Math.floor((slot & 3) / res);
    return { x: LEFT + b * (beatW + BEAT_GAP) + ((c + 0.5) * beatW) / n, w: beatW / n };
  };
  return {
    xOf: (slot) => cell(slot).x,
    xAt: (pos) => {
      const b = Math.min(3, Math.floor(pos / 4));
      return LEFT + b * (beatW + BEAT_GAP) + ((pos - b * 4) / 4) * beatW + beatW / cols(b) / 2;
    },
    widthOf: (slot) => cell(slot).w,
  };
}

/**
 * Natural layout, like engraved music: each note or rest gets room according to
 * how long it lasts (a little less than in proportion), plus a small gap between beats.
 */
function naturalLayout(pattern, width, s, voices) {
  const set = new Set();
  const extra = new Map(); // column → room for a flag or dot that sticks out to the right
  const room = (pos, w) => extra.set(pos, Math.max(extra.get(pos) || 0, w));
  for (const v of voices) {
    for (const beat of v) {
      if (beat.rest) set.add(beat.rest.pos);
      for (const o of beat.notes) {
        set.add(o.pos);
        if (o.flag) room(o.pos, 0.8);
        else if (o.dot) room(o.pos, 0.35);
      }
    }
  }
  if (!set.size) set.add(0);
  const cols = [...set].sort((a, b) => a - b);
  const weights = cols.map((p, i) => {
    const next = cols[i + 1] ?? 16;
    const beatGap = Math.floor((next - 1e-6) / 4) > Math.floor(p / 4) ? 0.4 : 0;
    return Math.max(1, next - p) ** 0.62 + beatGap + (next - p < 4 ? extra.get(p) || 0 : 0);
  });
  const lead = s * 1.05;
  const tail = s * 0.4;
  const unit = (width - LEFT - RIGHT - lead - tail) / weights.reduce((a, w) => a + w, 0);
  const xs = [];
  let x = LEFT + lead;
  for (const w of weights) {
    xs.push(x);
    x += w * unit;
  }
  const end = x;
  const xAt = (pos) => {
    if (pos <= cols[0]) return xs[0];
    let i = cols.length - 1;
    while (i > 0 && cols[i] > pos) i--;
    const p1 = cols[i + 1] ?? 16;
    const x1 = xs[i + 1] ?? end;
    return xs[i] + ((pos - cols[i]) / (p1 - cols[i])) * (x1 - xs[i]);
  };
  return { xOf: (slot) => xAt(posOf(pattern, slot)), xAt, widthOf: () => s * 2.4 };
}

// ---------- Drawing ----------

function drawVoice(c, beats, up) {
  const { g, s, yOf, L, colors } = c;
  const sg = up ? -1 : 1;
  const hw = s * 0.56;
  const stemLen = 3.3 * s;
  // Kick-voice rests sit below the staff so they never collide with the hands.
  const restY = up ? yOf(6) : yOf(-1.5);
  const th = 0.48 * s;
  const gap = 0.3 * s;
  const beam = (x1, x2, y0, level) => {
    const y = up ? y0 + level * (th + gap) : y0 - th - level * (th + gap);
    el(g, 'rect', { x: Math.min(x1, x2) - s * 0.065, y, width: Math.abs(x2 - x1) + s * 0.13, height: th, fill: 'currentColor' });
  };

  for (const beat of beats) {
    if (beat.covered) continue;
    const { notes, rest, trip } = beat;

    // Like most drum charts, skip whole-beat rests in the kick voice to reduce clutter.
    if (rest && !(rest.whole && !up)) {
      const x = L.xAt(rest.pos);
      if (rest.whole) drawRest(g, 4, x, restY, s);
      else if (trip) drawRest(g, rest.units === 2 ? 4 : 2, x, restY, s);
      else if (rest.units === 3) drawRest(g, 2, x + s * 0.3, restY, s, true); // dotted 8th rest
      else drawRest(g, rest.units === 1 ? 1 : 2, x, restY, s);
    }
    if (!notes.length) continue;

    for (const o of notes) {
      o.x = L.xOf(o.slot);
      const ys = o.insts.map((k) => yOf(k.step));
      o.tip = up ? Math.min(...ys) : Math.max(...ys);
      o.base = up ? Math.max(...ys) : Math.min(...ys);
      o.sx = up ? o.x + hw : o.x - hw;
      o.beamY = null;
    }

    // Beam runs of consecutive flagged notes; a lone one gets flags instead.
    const groups = [];
    let run = [];
    for (const o of notes) {
      if (o.beams > 0) run.push(o);
      else {
        if (run.length) groups.push(run);
        run = [];
      }
    }
    if (run.length) groups.push(run);
    for (const grp of groups) {
      if (grp.length < 2) continue;
      const y0 = up ? Math.min(...grp.map((o) => o.tip)) - stemLen : Math.max(...grp.map((o) => o.tip)) + stemLen;
      for (const o of grp) o.beamY = y0;
    }

    for (const o of notes) {
      for (const k of o.insts) {
        const y = yOf(k.step);
        drawLedgers(g, o.x, k.step, yOf, s);
        drawHead(g, k.head, o.x, y, s, colors[`${k.id}:${o.slot}`] || 'currentColor', {}, o.hollow ? (o.long === 16 ? 'whole' : 'half') : null);
        if (o.dot) {
          const onLine = k.step % 2 === 0;
          el(g, 'circle', { cx: o.x + hw + 0.5 * s, cy: onLine ? y - s / 2 : y, r: s * 0.17, fill: 'currentColor' });
        }
      }
      if (!o.stem) continue;
      const end = o.beamY ?? o.tip + sg * stemLen;
      el(g, 'line', { x1: o.sx, x2: o.sx, y1: o.base, y2: end, stroke: 'currentColor', 'stroke-width': s * 0.13 });
      if (o.beamY == null && o.beams) drawFlags(g, o.beams, o.sx, end, up, s);
    }

    for (const grp of groups) {
      if (grp.length < 2) continue;
      const y0 = grp[0].beamY;
      beam(grp[0].sx, grp[grp.length - 1].sx, y0, 0);
      grp.forEach((o, i) => {
        if (o.beams !== 2) return;
        const prev = grp[i - 1];
        const next = grp[i + 1];
        if (next && next.beams === 2) beam(o.sx, next.sx, y0, 1);
        else if (!(prev && prev.beams === 2)) {
          const stub = s * 1.0;
          if (i === grp.length - 1) beam(o.sx - stub, o.sx, y0, 1);
          else beam(o.sx, o.sx + stub, y0, 1);
        }
      });
    }

    // Triplet "3", with a bracket unless a single beam already joins the whole beat.
    if (trip && !(notes.length === 1 && notes[0].j === 0)) {
      const x1 = rest ? L.xAt(rest.pos) : notes[0].x;
      const x2 = notes[notes.length - 1].x;
      const reach = notes.map((o) => (o.stem ? o.beamY ?? o.tip + sg * stemLen : o.tip));
      const edge = up ? Math.min(...reach) - s * 1.1 : Math.max(...reach) + s * 1.1;
      const oneBeam = !rest && groups.length === 1 && groups[0].length === notes.length && notes.length > 1;
      const bx1 = (up ? x1 + hw : x1 - hw) - s * 0.4;
      const bx2 = (up ? x2 + hw : x2 - hw) + s * 0.4;
      const mid = (bx1 + bx2) / 2;
      if (!oneBeam) {
        const hook = -sg * s * 0.55;
        const gapW = s * 0.7;
        const stroke = { fill: 'none', stroke: 'currentColor', 'stroke-width': s * 0.11 };
        el(g, 'path', { d: `M${bx1} ${edge + hook} V${edge} H${mid - gapW}`, ...stroke });
        el(g, 'path', { d: `M${mid + gapW} ${edge} H${bx2} V${edge + hook}`, ...stroke });
      }
      const t = el(g, 'text', {
        x: mid, y: edge, class: 'tuplet', 'font-size': s * 1.35,
        'text-anchor': 'middle', 'dominant-baseline': 'central',
      });
      t.textContent = '3';
    }
  }
}

/**
 * Render a one-bar groove.
 * @param {HTMLElement} host
 * @param {{pattern: object, layout?: 'natural'|'grid', res?: 1|2, colors?: object, s?: number}} opts
 *   layout: 'natural' spaces notes by length (default); 'grid' spaces them evenly
 *           to line up with the Build step grid (res: 1 = 16th columns, 2 = 8th columns)
 *   colors: { 'snare:4': 'var(--green)' } to tint individual noteheads
 */
export function renderPattern(host, { pattern, layout = 'natural', res = 1, colors = {}, s }) {
  const width = Math.max(260, Math.floor(host.clientWidth) || 320);
  s = s || Math.max(9, Math.min(11, width / 40)); // staff space in px; grows a little on wider screens
  const { yOf, height } = geometry(s);
  const svg = makeSvg(host, width, height);

  const hasKick = DOWN_KIT.some((k) => pattern[k.id]?.some(Boolean));
  const upBeats = analyzeVoice(pattern, UP_KIT);
  const downBeats = hasKick ? analyzeVoice(pattern, DOWN_KIT) : null;
  const L = layout === 'grid'
    ? gridLayout(pattern, width, res)
    : naturalLayout(pattern, width, s, [upBeats, downBeats].filter(Boolean));

  const playhead = el(svg, 'rect', { class: 'playhead', y: 2, height: height - 4, width: 0, rx: 6, x: -999 });
  const g = el(svg, 'g');
  drawStaffLines(g, 4, width - 3, yOf);
  drawClef(g, 8, yOf, s);
  drawTimeSig(g, 8 + s * 2.9, yOf, s);
  el(g, 'line', { x1: width - 8, x2: width - 8, y1: yOf(8), y2: yOf(0), class: 'barline' });
  el(g, 'rect', { x: width - 5.5, y: yOf(8), width: 3, height: yOf(0) - yOf(8), fill: 'currentColor' });

  const c = { g, s, yOf, L, colors };
  drawVoice(c, upBeats, true);
  if (downBeats) drawVoice(c, downBeats, false);

  return {
    svg,
    xOf: L.xOf,
    setPlayhead(slot) {
      if (slot == null) return void playhead.setAttribute('x', -999);
      const w = L.widthOf(slot);
      playhead.setAttribute('width', w);
      playhead.setAttribute('rx', Math.min(6, w / 3));
      playhead.setAttribute('x', L.xOf(slot) - w / 2);
    },
  };
}

/**
 * Render a staff with individual notes (used by the quiz).
 * items: [{ step, head: 'x'|'o', foot?: boolean, color?, dx? (in spaces), opacity? }]
 */
export function renderSingle(host, { items = [], s = 13 }) {
  const width = Math.max(240, Math.floor(host.clientWidth) || 320);
  const { top, yOf, height } = geometry(s);
  const svg = makeSvg(host, width, height);
  const g = el(svg, 'g');
  drawStaffLines(g, 6, width - 6, yOf);
  drawClef(g, 14, yOf, s);
  const cx = width / 2;
  const hw = s * 0.56;
  for (const it of items) {
    const x = cx + (it.dx || 0) * s;
    const y = yOf(it.step);
    const color = it.color || 'currentColor';
    const ng = el(g, 'g', it.opacity != null ? { opacity: it.opacity } : {});
    drawLedgers(ng, x, it.step, yOf, s);
    drawHead(ng, it.head, x, y, s, color);
    const sx = it.foot ? x - hw : x + hw;
    el(ng, 'line', { x1: sx, x2: sx, y1: y, y2: it.foot ? y + 3.3 * s : y - 3.3 * s, stroke: color, 'stroke-width': s * 0.13 });
  }
  return {
    svg,
    height,
    stepFromY: (y) => Math.round(8 - (y - top) / (s / 2)),
  };
}
