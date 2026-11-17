// SVG drum-notation renderer.
//
// Hands (cymbals, snare, toms) are written as the upper voice with stems up;
// the kick is the lower voice with stems down — the standard drum-set layout.
// Beats can be straight (16th grid) or triplets. Notes are spaced by length, or
// evenly in 'grid' layout so the staff lines up with the Build step grid.
import { KIT } from './kit.js';
import {
  meterOf, beatsOf, barSlots, isTrip as tripOf, isTuplet, isCompound, slotPos as posOf, NOTE,
  isLongBeat, barLength, beatStart, beatLen, beatAt, isFine, allSlots, noteAt, rowHas,
} from './grooves.js';

/** Horizontal gutters shared with the step grid so columns line up exactly. */
export const LEFT = 56;
export const RIGHT = 20;

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

function drawTimeSig(g, x, yOf, s, meter) {
  const wide = meter.top > 9;
  for (const [st, n] of [[6, meter.top], [2, meter.bottom]]) {
    const t = el(g, 'text', {
      x: x + (wide ? s * 0.25 : 0), y: yOf(st), class: 'timesig', 'font-size': s * (wide ? 2.35 : 2.7),
      'text-anchor': 'middle', 'dominant-baseline': 'central',
    });
    if (wide) t.setAttribute('letter-spacing', -s * 0.15);
    t.textContent = String(n);
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
  if (kind === 'diamond') {
    const w = s * 0.62;
    const half = s * 0.52;
    return el(g, 'path', { d: `M${x - w} ${y}L${x} ${y - half}L${x + w} ${y}L${x} ${y + half}Z`, fill: color, ...extra });
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
  const flags = dur === 0.5 ? 3 : dur === 1 ? 2 : 1; // 32nd, 16th or 8th rest
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

function drawFlags(g, n, sx, endY, up, s, color = 'currentColor') {
  const sg = up ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const y = endY + sg * i * 0.85 * s;
    el(g, 'path', {
      d: `M${sx} ${y} c ${0.1 * s} ${sg * 0.9 * s} ${1.1 * s} ${sg * 1.1 * s} ${0.85 * s} ${sg * 2.4 * s}`,
      fill: 'none', stroke: color, 'stroke-width': s * 0.22, 'stroke-linecap': 'round',
    });
  }
}

/** Notes shown in gray (parts you don't play) get gray stems, flags and beams too. */
const MUTED = 'var(--ink3)';

// ---------- Articulations ----------

/** Accent: a ">" wedge centered on x. */
function drawAccent(g, x, y, s, color) {
  el(g, 'path', {
    d: `M${x - 0.62 * s} ${y - 0.36 * s}L${x + 0.62 * s} ${y}L${x - 0.62 * s} ${y + 0.36 * s}`,
    fill: 'none', stroke: color, 'stroke-width': s * 0.16, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  });
}

/** Open hi-hat: a small circle above the note. */
function drawOpen(g, x, y, s, color) {
  el(g, 'circle', { cx: x, cy: y, r: s * 0.36, fill: 'none', stroke: color, 'stroke-width': s * 0.14 });
}

/** Ghost note: parentheses around the notehead. */
function drawGhost(g, x, y, s, color) {
  const w = s * 1.0;
  const hgt = s * 0.62;
  const stroke = { fill: 'none', stroke: color, 'stroke-width': s * 0.12, 'stroke-linecap': 'round' };
  el(g, 'path', { d: `M${x - w} ${y - hgt}Q${x - w - 0.38 * s} ${y} ${x - w} ${y + hgt}`, ...stroke });
  el(g, 'path', { d: `M${x + w} ${y - hgt}Q${x + w + 0.38 * s} ${y} ${x + w} ${y + hgt}`, ...stroke });
}

/** Room (in staff spaces) a flam's grace note needs to the left of its note. */
const GRACE_DX = 1.75;

/** How far apart (in staff spaces) the two grace notes of a drag sit. */
const DRAG_DX = 0.95;

/**
 * Flam: a small slashed grace note just before the main note, joined by a slur.
 * Drag (count 2): two small notes joined by a beam, with no slash.
 */
function drawGrace(g, x, y, s, color, count = 1) {
  const r = 0.62;
  const top = y - s * 2.3;
  const stems = [];
  for (let i = 0; i < count; i++) {
    const gx = x - (GRACE_DX + i * DRAG_DX) * s;
    el(g, 'ellipse', { cx: gx, cy: y, rx: s * 0.6 * r, ry: s * 0.42 * r, transform: `rotate(-20 ${gx} ${y})`, fill: color });
    const sx = gx + s * 0.56 * r;
    stems.push(sx);
    el(g, 'line', { x1: sx, x2: sx, y1: y, y2: top, stroke: color, 'stroke-width': s * 0.1 });
  }
  const sx = stems[0];
  if (count === 1) {
    el(g, 'path', {
      d: `M${sx} ${top} c ${0.06 * s} ${0.55 * s} ${0.7 * s} ${0.7 * s} ${0.52 * s} ${1.5 * s}`,
      fill: 'none', stroke: color, 'stroke-width': s * 0.14, 'stroke-linecap': 'round',
    });
    el(g, 'line', { x1: sx - 0.45 * s, y1: top + 1.25 * s, x2: sx + 0.5 * s, y2: top + 0.45 * s, stroke: color, 'stroke-width': s * 0.1 });
  } else {
    for (const dy of [0, 0.42]) el(g, 'rect', { x: stems[count - 1] - s * 0.05, y: top + dy * s, width: sx - stems[count - 1] + s * 0.1, height: s * 0.26, fill: color });
  }
  const gx = x - (GRACE_DX + (count - 1) * DRAG_DX) * s;
  el(g, 'path', {
    d: `M${gx + 0.1 * s} ${y + 0.55 * s}Q${(gx + x) / 2} ${y + 1.25 * s} ${x - 0.45 * s} ${y + 0.6 * s}`,
    fill: 'none', stroke: color, 'stroke-width': s * 0.1, 'stroke-linecap': 'round',
  });
}

/** Tie: a curve from the note before, on the side away from the stems. */
function drawTie(g, x1, x2, y, s, up, color) {
  const d = up ? 1 : -1;
  el(g, 'path', {
    d: `M${x1} ${y + d * 0.6 * s}Q${(x1 + x2) / 2} ${y + d * 1.5 * s} ${x2} ${y + d * 0.6 * s}`,
    fill: 'none', stroke: color, 'stroke-width': s * 0.13, 'stroke-linecap': 'round',
  });
}

/** Sticking: R or L under each note that has one. */
function drawSticking(g, pattern, L, y, s) {
  pattern.stick?.forEach((v, slot) => {
    if (!v) return;
    const t = el(g, 'text', { x: L.xOf(slot), y, class: 'sticking', 'font-size': s * 1.25, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
    t.textContent = v === 1 ? 'R' : 'L';
  });
}

/** How far below the bottom staff line (in staff spaces) the sticking letters sit. */
const STICK_Y = 4.1;

// ---------- Rhythm analysis ----------
//
// Each voice is broken into beats. A beat holds its notes and the rest (if any)
// before its first note. Note values come from the gap to the next note:
//   straight beat (16th units): 1 = 16th, 2 = 8th, 3 = dotted 8th, 4 = quarter
//   triplet beat  (1/3-beat units): 1 = triplet 8th, 2 = triplet quarter
// With pattern.long, a note may instead last past its beat (dotted quarter, half,
// dotted half, whole); the beats it covers draw nothing.
// In 6/8 and 12/8 a beat is three 8ths: 1 = 8th, 2 = quarter, 3 = dotted quarter.

function analyzeVoice(pattern, kit) {
  const ons = [];
  const len = barSlots(pattern);
  const beats = beatsOf(pattern);
  const compound = isCompound(pattern);
  // Half slots (8.5 and so on) are the extra notes of a beat split in 32nds or sextuplets.
  for (const slot of allSlots(pattern)) {
    const insts = kit.filter((k) => noteAt(pattern, k.id, slot));
    const b = slot >> 2;
    if (insts.length) ons.push({ slot, b, j: slot - b * 4, pos: posOf(pattern, slot), insts, vals: insts.map((k) => noteAt(pattern, k.id, slot)) });
  }

  // Long notes: the longest standard value that fits the silence after the note.
  const cover = Array(beats).fill(0); // 16ths at the start of each beat still sounding from an earlier note
  if (pattern.long && !compound && !meterOf(pattern).odd) {
    ons.forEach((o, i) => {
      if (tripOf(pattern, o.b)) return;
      const p = o.pos;
      const gap = (ons[i + 1]?.pos ?? len) - p;
      let v = 0;
      if (p === 0 && len === 16 && gap >= 16) v = 16;
      else if (p === 0 && gap >= 12) v = 12;
      else if (p % 4 === 0 && p + 8 <= len && gap >= 8) v = 8;
      else if (p % 2 === 0 && gap === 6) v = 6;
      if (!v) return;
      for (let b = o.b + 1; b * 4 < p + v; b++) if (tripOf(pattern, b)) return;
      o.long = v;
      for (let b = o.b + 1; b * 4 < p + v; b++) cover[b] = Math.min(4, p + v - b * 4);
    });
  }

  return Array.from({ length: beats }, (_, b) => {
    const trip = tripOf(pattern, b);
    const units = trip ? 3 : 4;
    const start = cover[b];
    const notes = ons.filter((o) => o.b === b);
    // A beat that is three real 8ths long (all of 6/8, the last beat of 7/8) is written without a "3".
    const beat = { b, trip, tuplet: isTuplet(pattern, b), fine: isFine(pattern, b), compound: compound || isLongBeat(pattern, b), covered: start >= 4, notes, rest: null };
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
        o.beams = dur < 1 ? 2 : dur < 2 ? 1 : 0; // half a slot is a 16th here (one of a sextuplet's six)
        o.dot = beat.compound && dur === 3; // a whole compound beat is a dotted quarter
      } else {
        o.beams = dur < 1 ? 3 : dur < 2 ? 2 : dur < 4 ? 1 : 0; // 32nd, 16th, 8th, quarter
        o.dot = dur === 3 || dur === 1.5;
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
 * How much of the grid's width a beat takes, in 16ths. A beat split into 32nds
 * (or a sextuplet) gets twice the room, so its noteheads don't run into each other.
 */
export const gridWeight = (pattern, b) => beatLen(pattern, b) * (isFine(pattern, b) ? 2 : 1);
/** The narrowest (px) one column of the grid can be before its notes touch. */
const MIN_COL = 15;
/**
 * The least width (px) the grid layout needs for this bar, or 0 if any width will
 * do. Only a bar with a finer beat asks for room; Build scrolls sideways if it must.
 */
export function gridMinWidth(pattern) {
  const beats = beatsOf(pattern);
  if (!Array.from({ length: beats }, (_, b) => isFine(pattern, b)).some(Boolean)) return 0;
  let total = 0;
  for (let b = 0; b < beats; b++) total += gridWeight(pattern, b);
  return LEFT + RIGHT + (beats - 1) * BEAT_GAP + total * MIN_COL;
}

/**
 * Grid layout: the beats side by side with a gap between them, each split into
 * evenly spaced columns, so the staff lines up with the step grid below it.
 */
function gridLayout(pattern, width, res) {
  const beats = beatsOf(pattern);
  // Beats share the width by how long they last (the long beat of 7/8 is half as wide
  // again), and a beat of 32nds counts double.
  const before = [0];
  for (let b = 0; b < beats; b++) before.push(before[b] + gridWeight(pattern, b));
  const unit = (width - LEFT - RIGHT - (beats - 1) * BEAT_GAP) / before[beats]; // px per 16th of an ordinary beat
  const x0 = (b) => LEFT + before[b] * unit + b * BEAT_GAP;
  const wOf = (b) => gridWeight(pattern, b) * unit;
  const cols = (b) => (isFine(pattern, b) ? (tripOf(pattern, b) ? 6 : 8) : tripOf(pattern, b) ? 3 : 4 / res);
  const cell = (slot) => {
    const b = slot >> 2;
    const n = cols(b);
    const j = slot - b * 4;
    const c = isFine(pattern, b) ? Math.round(j * 2) : tripOf(pattern, b) ? j : Math.floor(j / res);
    return { x: x0(b) + ((c + 0.5) * wOf(b)) / n, w: wOf(b) / n };
  };
  return {
    xOf: (slot) => cell(slot).x,
    xAt: (pos) => {
      const b = beatAt(pattern, pos);
      return x0(b) + ((pos - beatStart(pattern, b)) / beatLen(pattern, b)) * wOf(b) + wOf(b) / cols(b) / 2;
    },
    widthOf: (slot) => cell(slot).w,
  };
}

/**
 * Natural layout, like engraved music: each note or rest gets room according to
 * how long it lasts (a little less than in proportion), plus a small gap between beats.
 */
function naturalLayout(pattern, width, s, voices, x0 = LEFT, x1 = width - RIGHT) {
  const len = barLength(pattern);
  const set = new Set();
  const extra = new Map(); // column → room for a flag or dot that sticks out to the right
  const before = new Map(); // column → room for a grace note on its left
  const room = (pos, w) => extra.set(pos, Math.max(extra.get(pos) || 0, w));
  for (const v of voices) {
    for (const beat of v) {
      if (beat.rest) set.add(beat.rest.pos);
      for (const o of beat.notes) {
        set.add(o.pos);
        if (o.flag) room(o.pos, 0.8);
        else if (o.dot) room(o.pos, 0.35);
        if (o.vals.includes(NOTE.FLAM)) before.set(o.pos, 0.9);
        if (o.vals.includes(NOTE.DRAG)) before.set(o.pos, 1.5);
        if (o.vals.includes(NOTE.GHOST)) room(o.pos, Math.max(extra.get(o.pos) || 0, 0.25));
      }
    }
  }
  if (!set.size) set.add(0);
  const cols = [...set].sort((a, b) => a - b);
  const weights = cols.map((p, i) => {
    const next = cols[i + 1] ?? len;
    const beatGap = beatAt(pattern, next - 1e-6) > beatAt(pattern, p) ? 0.4 : 0;
    return Math.max(1, next - p) ** 0.62 + beatGap + (next - p < 4 ? extra.get(p) || 0 : 0) + (before.get(cols[i + 1]) || 0);
  });
  const lead = s * (1.05 + (before.has(cols[0]) ? GRACE_DX * 0.9 + (before.get(cols[0]) > 1 ? DRAG_DX : 0) : 0));
  const tail = s * 0.4;
  const unit = (x1 - x0 - lead - tail) / weights.reduce((a, w) => a + w, 0);
  const xs = [];
  let x = x0 + lead;
  for (const w of weights) {
    xs.push(x);
    x += w * unit;
  }
  const end = x;
  const xAt = (pos) => {
    if (pos <= cols[0]) return xs[0];
    let i = cols.length - 1;
    while (i > 0 && cols[i] > pos) i--;
    const p1 = cols[i + 1] ?? len;
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
  const beam = (x1, x2, y0, level, color = 'currentColor') => {
    const y = up ? y0 + level * (th + gap) : y0 - th - level * (th + gap);
    el(g, 'rect', { x: Math.min(x1, x2) - s * 0.065, y, width: Math.abs(x2 - x1) + s * 0.13, height: th, fill: color });
  };

  let last = null; // the note before, for ties
  for (const beat of beats) {
    if (beat.covered) continue;
    const { notes, rest, trip } = beat;

    // Like most drum charts, skip whole-beat rests in the kick voice to reduce clutter.
    if (rest && !(rest.whole && !up)) {
      const x = L.xAt(rest.pos);
      if (rest.whole) drawRest(g, 4, x, restY, s, beat.compound); // dotted quarter rest in 6/8
      else if (trip) drawRest(g, rest.units >= 2 ? 4 : rest.units >= 1 ? 2 : 1, x, restY, s);
      else if (rest.units >= 3) drawRest(g, 2, x + s * 0.3, restY, s, true); // dotted 8th rest
      else drawRest(g, rest.units >= 2 ? 2 : rest.units >= 1 ? 1 : 0.5, x, restY, s);
    }
    if (!notes.length) continue;

    for (const o of notes) {
      o.x = L.xOf(o.slot);
      const ys = o.insts.map((k) => yOf(k.step));
      o.tip = up ? Math.min(...ys) : Math.max(...ys);
      o.base = up ? Math.max(...ys) : Math.min(...ys);
      o.sx = up ? o.x + hw : o.x - hw;
      o.beamY = null;
      o.ink = o.insts.every((k) => colors[`${k.id}:${o.slot}`] === MUTED) ? MUTED : 'currentColor';
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
      for (const [n, k] of o.insts.entries()) {
        const y = yOf(k.step);
        drawLedgers(g, o.x, k.step, yOf, s);
        // A cross-stick is an x where the snare goes; the ride's bell is a diamond.
        const head = o.vals[n] === NOTE.CROSS ? 'x' : o.vals[n] === NOTE.BELL ? 'diamond' : k.head;
        const ink = colors[`${k.id}:${o.slot}`] || 'currentColor';
        drawHead(g, head, o.x, y, s, ink, {}, o.hollow ? (o.long === 16 ? 'whole' : 'half') : null);
        // A rimshot is a note with a slash through it.
        if (o.vals[n] === NOTE.RIM) el(g, 'line', { x1: o.x - s * 0.95, y1: y + s * 0.78, x2: o.x + s * 0.95, y2: y - s * 0.78, stroke: ink, 'stroke-width': s * 0.15, 'stroke-linecap': 'round' });
        if (o.vals[n] === NOTE.TIE) drawTie(g, last ? last.x + hw * 0.9 : o.x - s * 2.4, o.x - hw * 0.9, y, s, up, ink);
        if (o.dot) {
          const onLine = k.step % 2 === 0;
          el(g, 'circle', { cx: o.x + hw + 0.5 * s, cy: onLine ? y - s / 2 : y, r: s * 0.17, fill: o.ink });
        }
      }
      // Ghost notes and flams belong to one drum in the chord.
      o.insts.forEach((k, n) => {
        const color = colors[`${k.id}:${o.slot}`] || 'currentColor';
        if (o.vals[n] === NOTE.GHOST) drawGhost(g, o.x, yOf(k.step), s, color);
        if (o.vals[n] === NOTE.FLAM) drawGrace(g, o.x, yOf(k.step), s, color);
        if (o.vals[n] === NOTE.DRAG) drawGrace(g, o.x, yOf(k.step), s, color, 2);
      });
      const end = o.stem ? o.beamY ?? o.tip + sg * stemLen : o.tip;
      o.reach = end;
      last = o;
      if (!o.stem) continue;
      el(g, 'line', { x1: o.sx, x2: o.sx, y1: o.base, y2: end, stroke: o.ink, 'stroke-width': s * 0.13 });
      if (o.vals.includes(NOTE.ROLL)) {
        // A roll: three short slashes across the stem.
        const my = o.tip + (end - o.tip) * 0.5;
        for (const dy of [-0.5, 0, 0.5]) {
          el(g, 'line', { x1: o.sx - s * 0.55, x2: o.sx + s * 0.55, y1: my + (dy + 0.22) * s, y2: my + (dy - 0.22) * s, stroke: o.ink, 'stroke-width': s * 0.22 });
        }
      }
      if (o.beamY == null && o.beams) drawFlags(g, o.beams, o.sx, end, up, s, o.ink);
    }

    // Accents and open hi-hat marks go past the stem end, away from the staff's middle.
    for (const o of notes) {
      const accent = o.vals.includes(NOTE.ACCENT);
      const open = o.vals.includes(NOTE.OPEN);
      if (!accent && !open) continue;
      const cx = o.stem ? (o.x + o.sx) / 2 : o.x;
      let y = o.reach + sg * s * (o.flag ? 1.6 : 1.0);
      if (up) y = Math.min(y, yOf(10) - s * 0.6);
      if (accent) {
        drawAccent(g, cx, y, s, o.ink);
        y += sg * s * 1.05;
      }
      if (open) drawOpen(g, cx, y, s, o.ink);
      o.reach = y;
    }

    for (const grp of groups) {
      if (grp.length < 2) continue;
      const y0 = grp[0].beamY;
      const ink = grp.every((o) => o.ink === MUTED) ? MUTED : 'currentColor';
      beam(grp[0].sx, grp[grp.length - 1].sx, y0, 0, ink);
      // The second beam joins 16ths (and anything shorter); the third joins 32nds.
      for (let level = 1; level <= 2; level++) {
        grp.forEach((o, i) => {
          if (o.beams <= level) return;
          const prev = grp[i - 1];
          const next = grp[i + 1];
          if (next && next.beams > level) beam(o.sx, next.sx, y0, level, ink);
          else if (!(prev && prev.beams > level)) {
            const stub = s * 1.0;
            if (i === grp.length - 1) beam(o.sx - stub, o.sx, y0, level, ink);
            else beam(o.sx, o.sx + stub, y0, level, ink);
          }
        });
      }
    }

    // Triplet "3", with a bracket unless a single beam already joins the whole beat.
    if (beat.tuplet && !(notes.length === 1 && notes[0].j === 0)) {
      const x1 = rest ? L.xAt(rest.pos) : notes[0].x;
      const x2 = notes[notes.length - 1].x;
      const reach = notes.map((o) => o.reach);
      const edge = up ? Math.min(...reach) - s * 1.1 : Math.max(...reach) + s * 1.1;
      const oneBeam = !rest && groups.length === 1 && groups[0].length === notes.length && notes.length > 1;
      const bx1 = (up ? x1 + hw : x1 - hw) - s * 0.4;
      const bx2 = (up ? x2 + hw : x2 - hw) + s * 0.4;
      const mid = (bx1 + bx2) / 2;
      if (!oneBeam) {
        const hook = -sg * s * 0.55;
        const gapW = s * 0.7;
        const stroke = { fill: 'none', stroke: notes.every((o) => o.ink === MUTED) ? MUTED : 'currentColor', 'stroke-width': s * 0.11 };
        el(g, 'path', { d: `M${bx1} ${edge + hook} V${edge} H${mid - gapW}`, ...stroke });
        el(g, 'path', { d: `M${mid + gapW} ${edge} H${bx2} V${edge + hook}`, ...stroke });
      }
      const t = el(g, 'text', {
        x: mid, y: edge, class: 'tuplet', 'font-size': s * 1.35,
        'text-anchor': 'middle', 'dominant-baseline': 'central',
      });
      t.textContent = beat.fine ? '6' : '3';
      if (notes.every((o) => o.ink === MUTED)) t.style.fill = MUTED;
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
 *   fit: trim empty space above and below the music (keeping a sensible minimum)
 */
export function renderPattern(host, { pattern, layout = 'natural', res = 1, colors = {}, s, fit = true }) {
  const width = Math.max(260, Math.floor(host.clientWidth) || 320);
  s = s || Math.max(9, Math.min(11, width / 40)); // staff space in px; grows a little on wider screens
  const { yOf, height } = geometry(s);
  const svg = makeSvg(host, width, height);

  const hasKick = DOWN_KIT.some((k) => rowHas(pattern, k.id));
  const upBeats = analyzeVoice(pattern, UP_KIT);
  const downBeats = hasKick ? analyzeVoice(pattern, DOWN_KIT) : null;
  const L = layout === 'grid'
    ? gridLayout(pattern, width, res)
    : naturalLayout(pattern, width, s, [upBeats, downBeats].filter(Boolean));

  const playhead = el(svg, 'rect', { class: 'playhead', y: 2, height: height - 4, width: 0, rx: 6, x: -999 });
  const g = el(svg, 'g');
  drawStaffLines(g, 4, width - 3, yOf);
  drawClef(g, 8, yOf, s);
  drawTimeSig(g, 8 + s * 2.9, yOf, s, meterOf(pattern));
  el(g, 'line', { x1: width - 8, x2: width - 8, y1: yOf(8), y2: yOf(0), class: 'barline' });
  el(g, 'rect', { x: width - 5.5, y: yOf(8), width: 3, height: yOf(0) - yOf(8), fill: 'currentColor' });
  // End repeat: the bar loops.
  for (const st of [5, 3]) el(g, 'circle', { cx: width - 8 - s * 0.6, cy: yOf(st), r: s * 0.19, fill: 'currentColor' });

  const c = { g, s, yOf, L, colors };
  drawVoice(c, upBeats, true);
  if (downBeats) drawVoice(c, downBeats, false);
  drawSticking(g, pattern, L, yOf(0) + s * STICK_Y, s);

  if (fit) {
    let box = null;
    try {
      box = g.getBBox(); // only works once the svg is in the page
    } catch { /* not rendered */ }
    if (box?.width) {
      const pad = s * 0.9;
      const y0 = Math.min(box.y - pad, yOf(8) - s * 3.4);
      const y1 = Math.max(box.y + box.height + pad, yOf(0) + s * 3.4);
      svg.setAttribute('viewBox', `0 ${y0} ${width} ${y1 - y0}`);
      svg.setAttribute('height', y1 - y0);
      playhead.setAttribute('y', y0 + 2);
      playhead.setAttribute('height', y1 - y0 - 4);
    }
  }

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
 * Render a chart: several bars, wrapped onto as many lines as they need.
 * colors are keyed 'bar:drum:slot'. On a narrow screen a long chart sits in a box
 * about two lines tall that follows the music as it plays.
 * @param {HTMLElement} host
 * endings: [first, second] bar numbers get "1." and "2." brackets; the first ends
 * with a repeat sign. Without endings the last bar ends with one (the chart loops).
 * full: show every line instead of a two-line box (for short examples in lessons).
 * @param {{bars: object[], colors?: object, endings?: number[], full?: boolean, s?: number}} opts
 */
export function renderChart(host, { bars, colors = {}, endings = null, full = false, s }) {
  const width = Math.max(260, Math.floor(host.clientWidth) || 320);
  s = s || Math.max(8.5, Math.min(10.5, width / 42));
  const hasKick = bars.some((p) => DOWN_KIT.some((k) => rowHas(p, k.id)));

  // Bars per line: as many as fit without crowding the busiest bar (1, 2 or 4).
  const busiest = Math.max(...bars.map((p) => {
    const used = new Set();
    for (const k of KIT) for (const sl of allSlots(p)) if (noteAt(p, k.id, sl)) used.add(sl);
    return used.size;
  }));
  const fitsAt = (sp) => Math.floor((width - LEFT - 12) / (busiest * sp * 1.25 + sp * 2));
  // On a narrow screen, 8th-note bars are drawn a little smaller so two still fit on a line.
  if (fitsAt(s) < 2 && fitsAt(s * 0.86) >= 2) s *= 0.86;
  const fits = fitsAt(s);
  const perLine = fits >= 4 ? 4 : fits >= 2 ? 2 : 1;
  const lines = Math.ceil(bars.length / perLine);
  const top = s * (endings ? 7 : 5.6); // room above the staff for cymbals, stems, accents (and ending brackets)
  const lowFoot = bars.some((p) => p.hhfoot?.some(Boolean)); // the hi-hat foot sits below the staff
  const sticks = bars.some((p) => p.stick?.some(Boolean)); // sticking letters go lowest of all
  const lineH = top + s * (sticks ? 9.6 : lowFoot ? 8.6 : 7.6); // …and below it for the kick's stems and rests

  const scroller = document.createElement('div');
  scroller.className = 'chart-scroll';
  if (lines > 2 && !full) scroller.style.maxHeight = `${Math.round(lineH * 2.3)}px`;
  host.replaceChildren(scroller);
  const svg = makeSvg(scroller, width, lineH * lines);
  const playhead = el(svg, 'rect', { class: 'playhead', y: 0, height: s * 10.5, width: 0, rx: 6, x: -999 });
  const g = el(svg, 'g');
  const end = width - 4;
  const where = []; // per bar: its layout and line

  for (let line = 0; line < lines; line++) {
    const yOf = (step) => line * lineH + top + ((8 - step) * s) / 2;
    const x0 = line === 0 ? LEFT - 4 : 8 + s * 1.9;
    const inLine = bars.slice(line * perLine, (line + 1) * perLine);
    const barW = (end - x0) / perLine;
    drawStaffLines(g, 4, x0 + inLine.length * barW + 1, yOf);
    drawClef(g, 8, yOf, s);
    if (line === 0) drawTimeSig(g, 8 + s * 2.9, yOf, s, meterOf(bars[0]));
    inLine.forEach((pattern, i) => {
      const n = line * perLine + i;
      const final = n === bars.length - 1;
      const repeatEnd = endings ? n === endings[0] : final;
      const bx0 = x0 + i * barW;
      const bx1 = bx0 + barW;
      if (repeatEnd || final) {
        // A thin and a thick line; with two dots it means "go back and repeat".
        el(g, 'line', { x1: bx1 - 4, x2: bx1 - 4, y1: yOf(8), y2: yOf(0), class: 'barline' });
        el(g, 'rect', { x: bx1 - 1.5, y: yOf(8), width: 3, height: yOf(0) - yOf(8), fill: 'currentColor' });
        if (repeatEnd) for (const st of [5, 3]) el(g, 'circle', { cx: bx1 - 4 - s * 0.6, cy: yOf(st), r: s * 0.19, fill: 'currentColor' });
      } else {
        el(g, 'line', { x1: bx1, x2: bx1, y1: yOf(8), y2: yOf(0), class: 'barline' });
      }
      const which = endings ? endings.indexOf(n) : -1;
      if (which >= 0) {
        // Ending bracket: "1." is closed at the right, "2." is left open.
        const by = yOf(8) - s * 6.3;
        const bl = bx0 + 3;
        const br = bx1 - 5;
        el(g, 'path', {
          d: `M${bl} ${by + s * 1.5} V${by} H${br}${which === 0 ? ` V${by + s * 1.5}` : ''}`,
          fill: 'none', stroke: 'currentColor', 'stroke-width': s * 0.11,
        });
        const t = el(g, 'text', { x: bl + s * 0.45, y: by + s * 0.85, class: 'ending', 'font-size': s * 1.2, 'dominant-baseline': 'central' });
        t.textContent = `${which + 1}.`;
      }
      const upBeats = analyzeVoice(pattern, UP_KIT);
      const downBeats = hasKick ? analyzeVoice(pattern, DOWN_KIT) : null;
      const L = naturalLayout(pattern, width, s, [upBeats, downBeats].filter(Boolean), bx0, bx1 - s * (repeatEnd ? 1.6 : final ? 1 : 0.5));
      const pre = `${n}:`;
      const own = {};
      for (const k in colors) if (k.startsWith(pre)) own[k.slice(pre.length)] = colors[k];
      const c = { g, s, yOf, L, colors: own };
      drawVoice(c, upBeats, true);
      if (downBeats) drawVoice(c, downBeats, false);
      drawSticking(g, pattern, L, yOf(0) + s * STICK_Y, s);
      where.push({ L, line });
    });
  }

  let shown = -1;
  return {
    svg,
    lines,
    /** Highlight a slot of a bar (and keep its line in view); null clears it. */
    setPlayhead(slot, bar = 0) {
      if (slot == null || !where[bar]) {
        shown = -1;
        return void playhead.setAttribute('x', -999);
      }
      const { L, line } = where[bar];
      const w = L.widthOf(slot);
      playhead.setAttribute('width', w);
      playhead.setAttribute('x', L.xOf(slot) - w / 2);
      playhead.setAttribute('y', line * lineH + top - s * 3.4);
      if (line !== shown) {
        shown = line;
        if (lines > 2) scroller.scrollTo({ top: Math.max(0, line * lineH - s * 0.5), behavior: 'smooth' });
      }
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
