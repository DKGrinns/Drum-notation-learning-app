// A groove is one bar of 4/4 on a 16th-note grid:
// { name, pattern: { [instrumentId]: number[16] } }  (1 = hit, 0 = rest)
import { KIT } from './kit.js';

export const STEPS = 16;

const Q = [0, 4, 8, 12];
const E = [0, 2, 4, 6, 8, 10, 12, 14];
const S = [...Array(16).keys()];

export const PRESETS = [
  { name: 'Quarter notes', level: 'Beginner', spec: { hihat: Q, snare: [4, 12], kick: [0, 8] } },
  { name: 'Basic rock', level: 'Beginner', spec: { hihat: E, snare: [4, 12], kick: [0, 8] } },
  { name: 'Rock with an “and”', level: 'Beginner', spec: { hihat: E, snare: [4, 12], kick: [0, 8, 10] } },
  { name: 'Four on the floor', level: 'Beginner', spec: { hihat: [2, 6, 10, 14], snare: [4, 12], kick: Q } },
  { name: 'Ride groove', level: 'Intermediate', spec: { crash: [0], ride: [2, 4, 6, 8, 10, 12, 14], snare: [4, 12], kick: [0, 6, 8] } },
  { name: 'Sixteenth hi-hats', level: 'Intermediate', spec: { hihat: S, snare: [4, 12], kick: [0, 8, 10] } },
  { name: 'Syncopated kick', level: 'Intermediate', spec: { hihat: E, snare: [4, 12], kick: [0, 3, 6, 10] } },
  { name: 'Around the toms', level: 'Intermediate', spec: { snare: [0, 1, 2, 3], tom1: [4, 5, 6, 7], tom2: [8, 9, 10, 11], floor: [12, 13, 14, 15], kick: Q } },
];

export function emptyPattern() {
  return Object.fromEntries(KIT.map((k) => [k.id, Array(STEPS).fill(0)]));
}

export function makeGroove(name, spec = {}) {
  const pattern = emptyPattern();
  for (const [id, slots] of Object.entries(spec)) for (const s of slots) pattern[id][s] = 1;
  return { name, pattern };
}

export function cloneGroove(g) {
  return { name: g.name, pattern: Object.fromEntries(Object.entries(g.pattern).map(([k, v]) => [k, [...v]])) };
}

/** Repair anything loaded from storage so it always has every instrument and 16 steps. */
export function normalizeGroove(g) {
  if (!g || typeof g !== 'object' || !g.pattern) return null;
  const pattern = emptyPattern();
  for (const k of KIT) {
    const row = g.pattern[k.id];
    if (Array.isArray(row)) for (let i = 0; i < STEPS; i++) pattern[k.id][i] = row[i] ? 1 : 0;
  }
  return { name: String(g.name || 'My groove'), pattern };
}

export function usedInstruments(g) {
  return KIT.filter((k) => g.pattern[k.id].some(Boolean));
}

export function isEmpty(g) {
  return usedInstruments(g).length === 0;
}

/** Finest subdivision used: 4 (quarters), 8 (eighths) or 16 (sixteenths). */
export function subdivision(g) {
  let finest = 4;
  for (const k of KIT) {
    g.pattern[k.id].forEach((on, i) => {
      if (!on) return;
      if (i % 2) finest = 16;
      else if (i % 4 && finest < 8) finest = 8;
    });
  }
  return finest;
}

export function subdivisionLabel(g) {
  return { 4: 'Quarter notes', 8: '8th notes', 16: '16th notes' }[subdivision(g)];
}

// ---------- Random grooves (sight-reading and ear training) ----------

export const LEVEL_NAMES = ['Beginner', 'Intermediate', 'Advanced'];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;
function sample(arr, n) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

/** Stable string for comparing two patterns. */
export function patternKey(p) {
  return KIT.map((k) => p[k.id].join('')).join('|');
}

/**
 * A playable one-bar groove for a level (0 Beginner, 1 Intermediate, 2 Advanced).
 * Beginner stays on 8th notes; Intermediate adds 16th kicks; Advanced adds
 * 16th hands and an occasional tom fill on beat 4.
 */
export function randomGroove(level = 0) {
  const spec = {};
  const hands = level === 0 ? pick(['hihat', 'hihat', 'hihat', 'ride']) : pick(['hihat', 'hihat', 'ride']);
  let handSlots = level === 0 ? (chance(0.3) ? Q : E) : level === 1 ? (chance(0.25) ? S : E) : (chance(0.55) ? S : E);
  spec[hands] = [...handSlots];
  spec.snare = [4, 12];
  if (hands === 'ride' && chance(0.6)) spec.crash = [0];

  const kickPool = level === 0 ? [2, 6, 8, 10, 14] : [3, 6, 7, 8, 10, 11, 14, 15].concat(level === 2 ? [2, 9, 13] : []);
  const nKicks = level === 0 ? pick([1, 2]) : level === 1 ? pick([2, 3]) : pick([2, 3, 4]);
  const kicks = new Set([0, ...sample(kickPool, nKicks)]);
  if (level === 0 && !kicks.has(8) && chance(0.6)) kicks.add(8);
  spec.kick = [...kicks];

  if (level >= 1 && chance(level === 1 ? 0.25 : 0.45)) {
    spec.snare.push(pick(level === 1 ? [14, 10] : [7, 10, 14, 15, 13]));
  }
  if (level === 2 && chance(0.4)) {
    // Fill on beat 4: hands move to the drums.
    spec[hands] = spec[hands].filter((s) => s < 12);
    spec.snare = spec.snare.filter((s) => s < 12).concat([12]);
    spec.tom1 = [13];
    spec.tom2 = [14];
    spec.floor = [15];
    spec.kick = spec.kick.filter((s) => s < 12);
    spec.crash = [0];
  }
  return makeGroove(`${LEVEL_NAMES[level]} groove`, spec);
}

/** One small, audible change to a groove (used to build "which one did you hear?" choices). */
function mutate(g, level) {
  const out = cloneGroove(g);
  const p = out.pattern;
  const grid = level === 0 ? E : S;
  const hand = ['hihat', 'ride'].find((id) => p[id].some(Boolean));
  const ops = [
    () => { // move a kick
      const on = grid.filter((s) => s && p.kick[s]);
      const off = grid.filter((s) => s && !p.kick[s] && !p.snare[s]);
      if (!on.length || !off.length) return false;
      p.kick[pick(on)] = 0;
      p.kick[pick(off)] = 1;
      return true;
    },
    () => { // add a kick
      const off = grid.filter((s) => s && !p.kick[s] && !p.snare[s]);
      if (!off.length) return false;
      p.kick[pick(off)] = 1;
      return true;
    },
    () => { // drop a kick
      const on = grid.filter((s) => s && p.kick[s]);
      if (!on.length) return false;
      p.kick[pick(on)] = 0;
      return true;
    },
    () => { // move the second backbeat
      if (!p.snare[12]) return false;
      p.snare[12] = 0;
      p.snare[pick(level === 0 ? [10, 14] : [10, 14, 11, 13])] = 1;
      return true;
    },
    () => { // change the hands' rhythm
      if (!hand) return false;
      const cur = p[hand].reduce((n, v) => n + v, 0);
      const next = level === 0 ? (cur > 4 ? Q : E) : cur > 8 ? E : S;
      const fill = p.tom1.some(Boolean);
      p[hand] = Array(STEPS).fill(0);
      for (const s of next) if (!fill || s < 12) p[hand][s] = 1;
      return true;
    },
  ];
  for (let tries = 0; tries < 10; tries++) if (pick(ops)()) return out;
  return out;
}

/** The groove plus `n - 1` look-alikes, shuffled. Returns { options, answer }. */
export function lookAlikes(g, n, level) {
  const seen = new Set([patternKey(g.pattern)]);
  const options = [g];
  const changes = level === 0 ? 2 : 1; // beginners get bigger differences
  for (let tries = 0; options.length < n && tries < 60; tries++) {
    let m = g;
    for (let i = 0; i < changes; i++) m = mutate(m, level);
    const key = patternKey(m.pattern);
    if (seen.has(key) || isEmpty(m)) continue;
    seen.add(key);
    options.push(m);
  }
  const shuffled = sample(options, options.length);
  return { options: shuffled, answer: shuffled.indexOf(g) };
}
