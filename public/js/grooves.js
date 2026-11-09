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
