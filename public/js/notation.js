// SVG drum-notation renderer.
//
// Hands (cymbals, snare, toms) are written as the upper voice with stems up;
// the kick is the lower voice with stems down — the standard drum-set layout.
// Notes are spaced evenly per 16th so the staff lines up with the step grid below it.
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

function drawHead(g, kind, x, y, s, color, extra = {}) {
  if (kind === 'x') {
    const r = s * 0.48;
    return el(g, 'path', {
      d: `M${x - r} ${y - r}L${x + r} ${y + r}M${x + r} ${y - r}L${x - r} ${y + r}`,
      stroke: color, 'stroke-width': s * 0.18, 'stroke-linecap': 'round', fill: 'none', ...extra,
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

function drawVoice(c, kit, beat, up) {
  const { g, s, yOf, xOf, colors, pattern } = c;
  const sg = up ? -1 : 1;
  const hw = s * 0.56;
  const stemLen = 3.3 * s;
  // Kick-voice rests sit below the staff so they never collide with the hands.
  const restY = up ? yOf(6) : yOf(-1.5);

  const ons = [];
  for (let j = 0; j < 4; j++) {
    const slot = beat * 4 + j;
    const insts = kit.filter((k) => pattern[k.id]?.[slot]);
    if (insts.length) ons.push({ j, slot, insts });
  }

  if (!ons.length) {
    // Like most drum charts, skip whole-beat rests in the kick voice to reduce clutter.
    if (up) drawRest(g, 4, xOf(beat * 4), restY, s);
    return;
  }

  // Rests before the first note of the beat.
  const first = ons[0].j;
  if (first === 1) drawRest(g, 1, xOf(beat * 4), restY, s);
  if (first === 2) drawRest(g, 2, xOf(beat * 4), restY, s);
  if (first === 3) drawRest(g, 2, xOf(beat * 4) + s * 0.3, restY, s, true); // dotted 8th rest

  ons.forEach((o, i) => {
    o.dur = (i < ons.length - 1 ? ons[i + 1].j : 4) - o.j; // in 16ths
    o.x = xOf(o.slot);
    const ys = o.insts.map((k) => yOf(k.step));
    o.tip = up ? Math.min(...ys) : Math.max(...ys);
    o.base = up ? Math.max(...ys) : Math.min(...ys);
    o.sx = up ? o.x + hw : o.x - hw;
  });

  const beamed = ons.length > 1;
  const beamY = beamed
    ? up ? Math.min(...ons.map((o) => o.tip)) - stemLen : Math.max(...ons.map((o) => o.tip)) + stemLen
    : null;

  for (const o of ons) {
    for (const k of o.insts) {
      const y = yOf(k.step);
      drawLedgers(g, o.x, k.step, yOf, s);
      drawHead(g, k.head, o.x, y, s, colors[`${k.id}:${o.slot}`] || 'currentColor');
      if (o.dur === 3) {
        const onLine = k.step % 2 === 0;
        el(g, 'circle', { cx: o.x + hw + 0.5 * s, cy: onLine ? y - s / 2 : y, r: s * 0.17, fill: 'currentColor' });
      }
    }
    const end = beamed ? beamY : o.tip + sg * stemLen;
    el(g, 'line', { x1: o.sx, x2: o.sx, y1: o.base, y2: end, stroke: 'currentColor', 'stroke-width': s * 0.13 });
    if (!beamed && o.dur < 4) drawFlags(g, o.dur === 1 ? 2 : 1, o.sx, end, up, s);
  }

  if (beamed) {
    const th = 0.48 * s;
    const gap = 0.3 * s;
    const beam = (x1, x2, level) => {
      const y = up ? beamY + level * (th + gap) : beamY - th - level * (th + gap);
      el(g, 'rect', { x: Math.min(x1, x2) - s * 0.065, y, width: Math.abs(x2 - x1) + s * 0.13, height: th, fill: 'currentColor' });
    };
    beam(ons[0].sx, ons[ons.length - 1].sx, 0);
    ons.forEach((o, i) => {
      if (o.dur !== 1) return;
      const prev = ons[i - 1];
      const next = ons[i + 1];
      if (next && next.dur === 1) beam(o.sx, next.sx, 1);
      else if (!(prev && prev.dur === 1)) {
        const stub = s * 1.0;
        if (i === ons.length - 1) beam(o.sx - stub, o.sx, 1);
        else beam(o.sx, o.sx + stub, 1);
      }
    });
  }
}

/**
 * Render a one-bar groove.
 * @param {HTMLElement} host
 * @param {{pattern: object, res?: 1|2, colors?: object, s?: number}} opts
 *   res: 1 = 16th-note columns, 2 = 8th-note columns (matches the step grid)
 *   colors: { 'snare:4': 'var(--green)' } to tint individual noteheads
 */
export function renderPattern(host, { pattern, res = 1, colors = {}, s }) {
  const width = Math.max(260, Math.floor(host.clientWidth) || 320);
  s = s || Math.max(9, Math.min(11, width / 40)); // staff space in px; grows a little on wider screens
  const { yOf, height } = geometry(s);
  const svg = makeSvg(host, width, height);
  const colW = (width - LEFT - RIGHT) / 16;
  const xOf = (slot) => LEFT + (slot + res / 2) * colW;

  const playhead = el(svg, 'rect', {
    class: 'playhead', y: 2, height: height - 4, width: colW * res, rx: Math.min(6, (colW * res) / 3), x: -999,
  });
  const g = el(svg, 'g');
  drawStaffLines(g, 4, width - 3, yOf);
  drawClef(g, 8, yOf, s);
  drawTimeSig(g, 8 + s * 2.9, yOf, s);
  el(g, 'line', { x1: width - 8, x2: width - 8, y1: yOf(8), y2: yOf(0), class: 'barline' });
  el(g, 'rect', { x: width - 5.5, y: yOf(8), width: 3, height: yOf(0) - yOf(8), fill: 'currentColor' });

  const c = { g, s, yOf, xOf, colors, pattern };
  const hasKick = DOWN_KIT.some((k) => pattern[k.id]?.some(Boolean));
  for (let b = 0; b < 4; b++) {
    drawVoice(c, UP_KIT, b, true);
    if (hasKick) drawVoice(c, DOWN_KIT, b, false);
  }

  return {
    svg,
    xOf,
    setPlayhead(slot) {
      playhead.setAttribute('x', slot == null ? -999 : xOf(slot) - (colW * res) / 2);
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
