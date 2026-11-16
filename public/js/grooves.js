// A groove is one bar:
// { name, pattern: { [instrumentId]: number[slots], meter?, trip?: number[beats], long?: boolean } }
//
// Each beat has four slots (beat * 4 + j). A straight beat uses all four as 16ths
// ("1 e & a"). A triplet beat (pattern.trip[beat] = 1) uses slots j = 0–2 as
// 8th-note triplets ("1 trip let") and leaves j = 3 empty.
//
// meter: '4/4' (default), '3/4', '6/8' or '12/8'. A bar has meter.beats beats,
// so a row has beats * 4 slots. In 6/8 and 12/8 (compound meters) the beat is a
// dotted quarter split into three 8ths, which uses the same three slots as a
// triplet beat ("1 & a"), but is written without the triplet 3.
//
// Each slot holds a note value: 0 = nothing, otherwise one of NOTE below
// (a plain hit, an accent, a ghost note, an open hi-hat or a flam).
// pattern.long asks the staff to write long notes (half, dotted quarter, whole)
// instead of short notes plus rests.
import { KIT } from './kit.js';

/** The most slots a row can have (a bar of 4/4 or 12/8). */
export const STEPS = 16;

export const METERS = {
  '4/4': { id: '4/4', beats: 4, top: 4, bottom: 4, name: 'Four-four' },
  '3/4': { id: '3/4', beats: 3, top: 3, bottom: 4, name: 'Three-four' },
  '2/4': { id: '2/4', beats: 2, top: 2, bottom: 4, name: 'Two-four' },
  '5/4': { id: '5/4', beats: 5, top: 5, bottom: 4, name: 'Five-four' },
  // Seven 8ths grouped 2 + 2 + 3: two ordinary beats, then one that is three 8ths long.
  '7/8': { id: '7/8', beats: 3, top: 7, bottom: 8, odd: [2], name: 'Seven-eight' },
  '6/8': { id: '6/8', beats: 2, top: 6, bottom: 8, compound: true, name: 'Six-eight' },
  '12/8': { id: '12/8', beats: 4, top: 12, bottom: 8, compound: true, name: 'Twelve-eight' },
};

/** Note values stored in a slot. */
export const NOTE = { HIT: 1, ACCENT: 2, GHOST: 3, OPEN: 4, FLAM: 5, CROSS: 6, BELL: 7, RIM: 8, DRAG: 9, ROLL: 10, TIE: 11 };
const NOTE_MAX = 11;
/** A tied note is held over from the note before it, so it is written but not struck. */
export const isHit = (v) => !!v && v !== NOTE.TIE;

/** The kinds of note you can write, and which drums they make sense on. */
export const NOTE_TYPES = [
  { value: NOTE.HIT, id: 'hit', label: 'Note', name: 'note' },
  { value: NOTE.ACCENT, id: 'accent', label: 'Accent', name: 'accent', on: null },
  { value: NOTE.GHOST, id: 'ghost', label: 'Ghost', name: 'ghost note', on: ['snare', 'tom1', 'tom2', 'floor'], where: 'the snare and toms' },
  { value: NOTE.OPEN, id: 'open', label: 'Open', name: 'open hi-hat', on: ['hihat'], where: 'the hi-hat' },
  { value: NOTE.FLAM, id: 'flam', label: 'Flam', name: 'flam', on: ['snare', 'tom1', 'tom2', 'floor'], where: 'the snare and toms' },
  { value: NOTE.CROSS, id: 'cross', label: 'Cross', name: 'cross-stick', on: ['snare'], where: 'the snare' },
  { value: NOTE.BELL, id: 'bell', label: 'Bell', name: 'ride bell', on: ['ride'], where: 'the ride' },
  { value: NOTE.RIM, id: 'rim', label: 'Rim', name: 'rimshot', on: ['snare'], where: 'the snare' },
  { value: NOTE.DRAG, id: 'drag', label: 'Drag', name: 'drag', on: ['snare', 'tom1', 'tom2', 'floor'], where: 'the snare and toms' },
  { value: NOTE.ROLL, id: 'roll', label: 'Roll', name: 'roll', on: ['snare', 'tom1', 'tom2', 'floor'], where: 'the snare and toms' },
  { value: NOTE.TIE, id: 'tie', label: 'Tie', name: 'tied note', on: null },
];
export const noteTypeFits = (type, id) => !type.on || type.on.includes(id);

const Q = [0, 4, 8, 12];
const E = [0, 2, 4, 6, 8, 10, 12, 14];
const S = [...Array(16).keys()];
const T = [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14]; // every triplet slot
const SH = [0, 2, 4, 6, 8, 10, 12, 14]; // shuffle: "1 – let 2 – let"
const ALL = [0, 1, 2, 3];

export const PRESETS = [
  { name: 'Quarter notes', level: 'Beginner', spec: { hihat: Q, snare: [4, 12], kick: [0, 8] } },
  { name: 'Basic rock', level: 'Beginner', spec: { hihat: E, snare: [4, 12], kick: [0, 8] } },
  { name: 'Rock with an “and”', level: 'Beginner', spec: { hihat: E, snare: [4, 12], kick: [0, 8, 10] } },
  { name: 'Four on the floor', level: 'Beginner', spec: { hihat: [2, 6, 10, 14], snare: [4, 12], kick: Q } },
  { name: 'Waltz', level: 'Beginner', spec: { meter: '3/4', hihat: [0, 2, 4, 6, 8, 10], snare: [4, 8], kick: [0] } },
  { name: 'Disco open hats', level: 'Intermediate', spec: { hihat: E, open: { hihat: [2, 6, 10, 14] }, snare: [4, 12], kick: Q } },
  { name: 'Accented 8ths', level: 'Intermediate', spec: { hihat: E, accent: { hihat: Q }, snare: [4, 12], kick: [0, 8, 10] } },
  { name: 'Shuffle', level: 'Intermediate', spec: { trip: ALL, hihat: SH, snare: [4, 12], kick: [0, 8, 10] } },
  { name: '6/8 groove', level: 'Intermediate', spec: { meter: '6/8', hihat: [0, 1, 2, 4, 5, 6], snare: [4], kick: [0] } },
  { name: '12/8 blues', level: 'Intermediate', spec: { meter: '12/8', ride: T, snare: [4, 12], kick: [0, 2, 8, 10] } },
  { name: 'Ride groove', level: 'Intermediate', spec: { crash: [0], ride: [2, 4, 6, 8, 10, 12, 14], snare: [4, 12], kick: [0, 6, 8] } },
  { name: 'Ride with hi-hat foot', level: 'Intermediate', spec: { ride: E, snare: [4, 12], kick: [0, 8, 10], hhfoot: [4, 12] } },
  { name: 'Sixteenth hi-hats', level: 'Intermediate', spec: { hihat: S, snare: [4, 12], kick: [0, 8, 10] } },
  { name: 'Syncopated kick', level: 'Intermediate', spec: { hihat: E, snare: [4, 12], kick: [0, 3, 6, 10] } },
  { name: 'Triplet feel', level: 'Intermediate', spec: { trip: ALL, ride: T, snare: [4, 12], kick: [0, 2, 8, 10] } },
  { name: 'Around the toms', level: 'Intermediate', spec: { snare: [0, 1, 2, 3], tom1: [4, 5, 6, 7], tom2: [8, 9, 10, 11], floor: [12, 13, 14, 15], kick: Q } },
  { name: 'Ghost-note funk', level: 'Advanced', spec: { hihat: E, snare: [4, 12], ghost: { snare: [7, 9, 15] }, kick: [0, 3, 10] } },
  { name: 'Flam backbeat', level: 'Advanced', spec: { hihat: E, flam: { snare: [12] }, snare: [4], kick: [0, 8, 10] } },
  { name: 'Triplet fill', level: 'Advanced', spec: { trip: [3], hihat: [0, 2, 4, 6, 8, 10], snare: [4, 12, 13], tom1: [14], kick: [0, 8] } },
  { name: 'Paradiddle', level: 'Intermediate', spec: { snare: S, accent: { snare: Q }, sticking: { R: [0, 2, 3, 5, 8, 10, 11, 13], L: [1, 4, 6, 7, 9, 12, 14, 15] } } },
  { name: 'Drags and a roll', level: 'Advanced', spec: { snare: [0, 8], drag: { snare: [4] }, roll: { snare: [12] }, kick: Q } },
  { name: 'Cross-stick ballad', level: 'Intermediate', spec: { hihat: E, cross: { snare: [4, 12] }, kick: [0, 6, 8] } },
  { name: 'Ride bell groove', level: 'Intermediate', spec: { ride: E, bell: { ride: Q }, snare: [4, 12], kick: [0, 8, 10] } },
  { name: '2/4 march', level: 'Beginner', spec: { meter: '2/4', hihat: [0, 2, 4, 6], snare: [4], kick: [0] } },
  { name: '7/8 groove', level: 'Advanced', spec: { meter: '7/8', hihat: [0, 2, 4, 6, 8, 9, 10], snare: [4, 10], kick: [0, 8] } },
  { name: '5/4 groove', level: 'Advanced', spec: { meter: '5/4', hihat: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18], snare: [4, 16], kick: [0, 6, 12] } },
];

// ---------- Meter ----------

export const meterOf = (p) => METERS[p?.meter] || METERS['4/4'];
export const beatsOf = (p) => meterOf(p).beats;
/** Slots in one bar (also the bar's length in 16th-note units of the beat). */
export const barSlots = (p) => beatsOf(p) * 4;
export const isCompound = (p) => !!meterOf(p).compound;
/** Count-in beats: one bar, or two bars when a bar is only two beats long. */
export const countInFor = (p) => (beatsOf(p) < 3 ? beatsOf(p) * 2 : beatsOf(p));

export function emptyPattern(meter = '4/4') {
  const m = METERS[meter] || METERS['4/4'];
  const p = Object.fromEntries(KIT.map((k) => [k.id, Array(m.beats * 4).fill(0)]));
  if (m.id !== '4/4') p.meter = m.id;
  return p;
}

/** Copy the rhythm settings (meter, triplet beats, long notes) from one pattern to another. */
export function copyMeta(from, to) {
  if (from.meter && from.meter !== '4/4') to.meter = from.meter;
  if (from.trip?.some(Boolean)) to.trip = [...from.trip];
  if (from.stick?.some(Boolean)) to.stick = [...from.stick];
  if (from.long) to.long = true;
  return to;
}

const MARKS = {
  accent: NOTE.ACCENT, ghost: NOTE.GHOST, open: NOTE.OPEN, flam: NOTE.FLAM, cross: NOTE.CROSS, bell: NOTE.BELL,
  rim: NOTE.RIM, drag: NOTE.DRAG, roll: NOTE.ROLL, tie: NOTE.TIE,
};

/**
 * spec: { instrumentId: slots[], meter?, trip?: beats[], long?: true,
 *         accent?|ghost?|open?|flam?: { instrumentId: slots[] } }
 */
export function makeGroove(name, spec = {}) {
  const pattern = emptyPattern(spec.meter);
  for (const [id, slots] of Object.entries(spec)) {
    if (Array.isArray(pattern[id])) for (const s of slots) pattern[id][s] = NOTE.HIT;
  }
  for (const [mark, value] of Object.entries(MARKS)) {
    for (const [id, slots] of Object.entries(spec[mark] || {})) {
      if (pattern[id]) for (const s of slots) pattern[id][s] = value;
    }
  }
  if (spec.trip?.length && !isCompound(pattern)) {
    pattern.trip = Array(beatsOf(pattern)).fill(0);
    for (const b of spec.trip) pattern.trip[b] = 1;
  }
  if (spec.long) pattern.long = true;
  // sticking: { R: slots[], L: slots[] } writes which hand plays each note.
  if (spec.sticking) {
    pattern.stick = Array(barSlots(pattern)).fill(0);
    for (const s of spec.sticking.R || []) pattern.stick[s] = 1;
    for (const s of spec.sticking.L || []) pattern.stick[s] = 2;
  }
  return { name, pattern };
}

export function clonePattern(p) {
  const out = Object.fromEntries(KIT.map((k) => [k.id, [...p[k.id]]]));
  return copyMeta(p, out);
}

export function cloneGroove(g) {
  return { name: g.name, pattern: clonePattern(g.pattern) };
}

/** Repair anything loaded from storage so it always has every instrument and the right number of slots. */
export function normalizeGroove(g) {
  if (!g || typeof g !== 'object' || !g.pattern) return null;
  const pattern = emptyPattern(g.pattern.meter);
  const n = barSlots(pattern);
  for (const k of KIT) {
    const row = g.pattern[k.id];
    if (!Array.isArray(row)) continue;
    for (let i = 0; i < n; i++) {
      const v = Math.round(Number(row[i]) || 0);
      pattern[k.id][i] = v >= 1 && v <= NOTE_MAX ? v : row[i] === true ? 1 : 0;
    }
  }
  if (!isCompound(pattern) && Array.isArray(g.pattern.trip) && g.pattern.trip.some(Boolean)) {
    pattern.trip = Array.from({ length: beatsOf(pattern) }, (_, b) => (g.pattern.trip[b] && !isLongBeat(pattern, b) ? 1 : 0));
    if (!pattern.trip.some(Boolean)) delete pattern.trip;
  }
  for (const k of KIT) for (let b = 0; b < beatsOf(pattern); b++) if (isTrip(pattern, b)) pattern[k.id][b * 4 + 3] = 0;
  if (g.pattern.long) pattern.long = true;
  if (Array.isArray(g.pattern.stick)) {
    const hand = (i) => (isTrip(pattern, i >> 2) && (i & 3) === 3 ? 0 : g.pattern.stick[i] === 1 || g.pattern.stick[i] === 2 ? g.pattern.stick[i] : 0);
    const stick = Array.from({ length: n }, (_, i) => hand(i));
    if (stick.some(Boolean)) pattern.stick = stick;
  }
  return { name: String(g.name || 'My groove'), pattern };
}

// ---------- Rhythm helpers ----------

/** A beat split in three: a triplet beat, or any beat of a compound meter. */
/** A beat that is three 8ths long in a meter whose other beats are two (the last beat of 7/8). */
export const isLongBeat = (p, beat) => !!meterOf(p).odd?.includes(beat);
/** A beat split in three: a triplet, a compound-meter beat, or a long beat. */
export const isTrip = (p, beat) => isCompound(p) || isLongBeat(p, beat) || !!p.trip?.[beat];
/** A triplet beat that needs the "3" (not just a beat that is three 8ths long). */
export const isTuplet = (p, beat) => !isCompound(p) && !isLongBeat(p, beat) && !!p.trip?.[beat];

/** How long a beat lasts, in 16ths of an ordinary beat. */
export const beatLen = (p, beat) => (isLongBeat(p, beat) ? 6 : 4);
/** Where a beat starts in the bar, in 16ths. */
export function beatStart(p, beat) {
  let at = 0;
  for (let b = 0; b < beat; b++) at += beatLen(p, b);
  return at;
}
/** The length of the whole bar, in 16ths. */
export const barLength = (p) => beatStart(p, beatsOf(p));
/** The beat that a position (in 16ths) falls in. */
export function beatAt(p, pos) {
  let b = 0;
  while (b < beatsOf(p) - 1 && pos >= beatStart(p, b + 1)) b++;
  return b;
}

/** Where a slot falls in the bar, in 16ths of a beat (three-way beats land on thirds). */
export function slotPos(p, slot) {
  const b = slot >> 2;
  const j = slot & 3;
  return beatStart(p, b) + (isLongBeat(p, b) ? j * 2 : isTrip(p, b) ? (j * 4) / 3 : j);
}

/** Slots that exist in this pattern's rhythm grid. */
export function validSlots(p) {
  const out = [];
  for (let s = 0; s < barSlots(p); s++) if (!(isTrip(p, s >> 2) && (s & 3) === 3)) out.push(s);
  return out;
}

/** Count for a slot: "2 &", "3 e", "4 trip", or "2 a" in 6/8. */
export function countLabel(slot, p = {}) {
  const b = slot >> 2;
  const j = slot & 3;
  if (meterOf(p).odd) {
    // 7/8 is counted in 8ths: 1 2, 3 4, 5 6 7. A 16th in between is an "&".
    const first = beatStart(p, b) / 2 + 1;
    if (isLongBeat(p, b)) return String(first + j);
    return `${first + (j >> 1)}${j % 2 ? ' &' : ''}`;
  }
  const names = isCompound(p) ? ['', ' &', ' a'] : isTrip(p, b) ? ['', ' trip', ' let'] : ['', ' e', ' &', ' a'];
  return `${b + 1}${names[j]}`;
}

/** Shortest distance (in 16ths) between consecutive notes of one instrument, wrapping round the bar. */
export function nearestGap(p, id) {
  const pos = [];
  p[id].forEach((on, i) => on && pos.push(slotPos(p, i)));
  if (pos.length < 2) return 4;
  let min = barLength(p) - pos[pos.length - 1] + pos[0];
  for (let i = 1; i < pos.length; i++) min = Math.min(min, pos[i] - pos[i - 1]);
  return min;
}

export function usedInstruments(g) {
  return KIT.filter((k) => g.pattern[k.id].some(Boolean));
}

export function isEmpty(g) {
  return usedInstruments(g).length === 0;
}

/** Note types (other than plain hits) used anywhere in the groove. */
export function usedNoteTypes(p) {
  const set = new Set();
  for (const k of KIT) for (const v of p[k.id]) if (v > 1) set.add(v);
  return NOTE_TYPES.filter((t) => set.has(t.value));
}

/** Finest straight subdivision used: 4 (quarters), 8 (eighths) or 16 (sixteenths). Three-way beats don't count. */
export function subdivision(g) {
  let finest = 4;
  for (const k of KIT) {
    g.pattern[k.id].forEach((on, i) => {
      if (!on || isTrip(g.pattern, i >> 2)) return;
      if (i % 2) finest = 16;
      else if (i % 4 && finest < 8) finest = 8;
    });
  }
  return finest;
}

export function subdivisionLabel(g) {
  const p = g.pattern;
  const m = meterOf(p);
  if (m.compound) return `${m.id} · 8th notes`;
  const trips = p.trip?.filter(Boolean).length || 0;
  const pre = m.id === '4/4' ? '' : `${m.id} · `;
  if (trips && trips === m.beats) return `${pre}Triplets`;
  const base = { 4: 'Quarter notes', 8: '8th notes', 16: '16th notes' }[subdivision(g)];
  return `${pre}${trips ? `${base} + triplets` : base}`;
}

// ---------- Random grooves (sight-reading and ear training) ----------

export const LEVEL_NAMES = ['Beginner', 'Intermediate', 'Advanced'];

/** Extra sight-reading styles beyond the three levels. */
export const STYLES = [
  { id: 'shuffle', name: 'Shuffle' },
  { id: '3/4', name: '3/4 time' },
  { id: '6/8', name: '6/8 and 12/8' },
  { id: 'dynamics', name: 'Accents and ghosts' },
];

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
  return `${p.meter || '4/4'}|${KIT.map((k) => p[k.id].join('')).join('|')}|${(p.trip || []).join('')}|${p.long ? 1 : 0}`;
}

/**
 * A playable one-bar groove for a level (0 Beginner, 1 Intermediate, 2 Advanced)
 * or a style id from STYLES. Beginner stays on 8th notes; Intermediate adds 16th
 * kicks; Advanced adds 16th hands, accents, ghost notes and an occasional tom fill.
 */
export function randomGroove(level = 0) {
  if (typeof level === 'string') return styleGroove(level);
  const spec = {};
  const hands = level === 0 ? pick(['hihat', 'hihat', 'hihat', 'ride']) : pick(['hihat', 'hihat', 'ride']);
  let handSlots = level === 0 ? (chance(0.3) ? Q : E) : level === 1 ? (chance(0.25) ? S : E) : (chance(0.55) ? S : E);
  spec[hands] = [...handSlots];
  spec.snare = [4, 12];
  if (hands === 'ride' && chance(0.6)) spec.crash = [0];
  // With the right hand on the ride, the left foot often keeps time on the hi-hat pedal.
  if (hands === 'ride' && level >= 1 && chance(0.5)) spec.hhfoot = [4, 12];

  const kickPool = level === 0 ? [2, 6, 8, 10, 14] : [3, 6, 7, 8, 10, 11, 14, 15].concat(level === 2 ? [2, 9, 13] : []);
  const nKicks = level === 0 ? pick([1, 2]) : level === 1 ? pick([2, 3]) : pick([2, 3, 4]);
  const kicks = new Set([0, ...sample(kickPool, nKicks)]);
  if (level === 0 && !kicks.has(8) && chance(0.6)) kicks.add(8);
  spec.kick = [...kicks];

  if (level >= 1 && chance(level === 1 ? 0.25 : 0.45)) {
    spec.snare.push(pick(level === 1 ? [14, 10] : [7, 10, 14, 15, 13]));
  }
  let fill = false;
  if (level === 2 && chance(0.35)) {
    // Fill on beat 4: hands move to the drums.
    fill = true;
    spec[hands] = spec[hands].filter((s) => s < 12);
    spec.snare = spec.snare.filter((s) => s < 12).concat([12]);
    spec.tom1 = [13];
    spec.tom2 = [14];
    spec.floor = [15];
    spec.kick = spec.kick.filter((s) => s < 12);
    if (spec.hhfoot) spec.hhfoot = spec.hhfoot.filter((s) => s < 12);
    spec.crash = [0];
  }
  if (level === 2 && !fill) addDynamics(spec, hands, chance(0.5));
  return makeGroove(`${LEVEL_NAMES[level]} groove`, spec);
}

/** Accents on the hands' beats, and sometimes ghost notes or an open hi-hat. */
function addDynamics(spec, hands, ghosts) {
  if (chance(0.5)) spec.accent = { [hands]: spec[hands].filter((s) => s % 4 === 0) };
  if (ghosts) {
    const free = [3, 7, 9, 11, 15].filter((s) => !spec.snare.includes(s) && !spec.kick.includes(s));
    spec.ghost = { snare: sample(free, pick([1, 2])) };
  } else if (hands === 'hihat' && chance(0.6) && spec.hihat.includes(14)) {
    spec.open = { hihat: [14] };
    spec.hihat = spec.hihat.filter((s) => s !== 15);
  }
}

function styleGroove(id) {
  const name = STYLES.find((s) => s.id === id)?.name || 'Groove';
  if (id === 'shuffle') {
    const hands = pick(['hihat', 'ride']);
    const kick = new Set([0, ...sample([2, 6, 8, 10, 14], pick([1, 2, 3]))]);
    const spec = { trip: ALL, [hands]: SH, snare: [4, 12], kick: [...kick] };
    if (chance(0.4)) spec.ghost = { snare: sample([1, 9, 14], 1).filter((s) => !kick.has(s)) };
    return makeGroove(`${name} groove`, spec);
  }
  if (id === '3/4') {
    const hands = pick(['hihat', 'ride']);
    const spec = { meter: '3/4', [hands]: chance(0.3) ? [0, 4, 8] : [0, 2, 4, 6, 8, 10], kick: [0] };
    if (chance(0.5)) {
      spec.snare = [4, 8]; // waltz: boom, chick, chick
    } else {
      spec.snare = [8]; // slow rock in 3
      spec.kick = [0, ...sample([2, 6, 10], pick([0, 1]))];
    }
    if (chance(0.3)) spec.kick.push(6);
    return makeGroove(`${name} groove`, spec);
  }
  if (id === '6/8') {
    const meter = pick(['6/8', '6/8', '12/8']);
    const beats = METERS[meter].beats;
    const all = [];
    for (let b = 0; b < beats; b++) all.push(b * 4, b * 4 + 1, b * 4 + 2);
    const hands = pick(['hihat', 'ride']);
    const spec = { meter, [hands]: chance(0.25) ? all.filter((s) => (s & 3) !== 1) : all };
    // Backbeat on the second dotted-quarter pulse of each pair.
    spec.snare = [];
    for (let b = 1; b < beats; b += 2) spec.snare.push(b * 4);
    const kick = new Set([0]);
    for (let b = 0; b < beats; b += 2) {
      if (b) kick.add(b * 4);
      if (chance(0.5)) kick.add(b * 4 + 2);
    }
    if (chance(0.4)) kick.add((beats - 1) * 4 + 2);
    spec.kick = [...kick].filter((s) => !spec.snare.includes(s));
    if (chance(0.4)) spec.accent = { [hands]: all.filter((s) => (s & 3) === 0) };
    return makeGroove(`${meter} groove`, spec);
  }
  // Accents and ghost notes on a 16th-based funk feel.
  const spec = { hihat: chance(0.5) ? S : E, snare: [4, 12], kick: [0, ...sample([3, 6, 8, 10, 11, 14], pick([2, 3]))] };
  spec.accent = { hihat: spec.hihat.filter((s) => s % 4 === 0) };
  const free = [1, 3, 7, 9, 11, 13, 15].filter((s) => !spec.kick.includes(s));
  spec.ghost = { snare: sample(free, pick([2, 3])) };
  if (chance(0.3)) spec.flam = { snare: [12] };
  return makeGroove(`${name} groove`, spec);
}

// ---------- Charts (several bars) ----------
//
// A chart is { name, bars: pattern[], order?, endings? }: one-bar patterns in the
// same meter. Without `order` the bars are played once each, in order.
// A chart with a repeat has endings: [first, second] (bar numbers) and an order
// such as [0, 1, 2, 3, 0, 1, 2, 4]: play to the first ending, go back to the
// start, then skip to the second ending.

const HANDS = KIT.filter((k) => !k.foot).map((k) => k.id);

/** Drums used anywhere in a list of bars. */
export function chartInstruments(bars) {
  return KIT.filter((k) => bars.some((p) => p[k.id].some(Boolean)));
}

/** Repair a chart loaded from storage. */
export function normalizeChart(c) {
  if (!c || !Array.isArray(c.bars) || !c.bars.length) return null;
  const bars = c.bars.map((p) => normalizeGroove({ pattern: p })?.pattern).filter(Boolean);
  if (bars.length !== c.bars.length || bars.some((p) => meterOf(p) !== meterOf(bars[0]))) return null;
  const out = { name: String(c.name || 'Chart'), bars };
  const isBar = (i) => Number.isInteger(i) && i >= 0 && i < bars.length;
  if (Array.isArray(c.order) && c.order.length && c.order.every(isBar)) out.order = [...c.order];
  if (out.order && Array.isArray(c.endings) && c.endings.length === 2 && c.endings.every(isBar)) out.endings = [...c.endings];
  return out;
}

/** The bar numbers in the order they are played. */
export const chartOrder = (c) => c.order || c.bars.map((_, i) => i);

/**
 * A repeat with two endings for a chart of n bars (3 or more): the last two bars
 * are the first and second endings. Returns { order, endings }.
 */
export function repeatForm(n) {
  const head = Array.from({ length: n - 2 }, (_, i) => i);
  return { order: [...head, n - 2, ...head, n - 1], endings: [n - 2, n - 1] };
}

/** The same bar with a kick added (and sometimes one taken away). */
function varyKick(p, level) {
  const out = clonePattern(p);
  const grid = level === 0 ? E : S;
  const on = grid.filter((s) => s && out.kick[s]);
  const off = grid.filter((s) => s && !out.kick[s] && !out.snare[s]);
  if (!off.length) return out;
  if (on.length && chance(0.6)) out.kick[pick(on)] = 0;
  out.kick[pick(off)] = NOTE.HIT;
  return out;
}

/** Turn the end of a bar into a fill: the hands leave the groove for the snare and toms. */
function addFill(p, level) {
  const put = (b, ids) => {
    for (const id of HANDS) for (let j = 0; j < 4; j++) p[id][b * 4 + j] = 0;
    for (let j = 1; j < 4; j++) p.kick[b * 4 + j] = 0;
    ids.forEach((id, j) => {
      if (id) p[id][b * 4 + j] = NOTE.HIT;
    });
  };
  const last = beatsOf(p) - 1;
  if (isTrip(p, last)) {
    return put(last, level === 0 ? ['snare', 'snare', 'snare'] : pick([['snare', 'tom1', 'floor'], ['snare', 'snare', 'floor'], ['tom1', 'tom2', 'floor']]));
  }
  if (level === 0) return put(last, pick([['snare', 0, 'snare'], ['snare', 0, 'floor'], ['tom1', 0, 'floor']]));
  if (level === 2 && last >= 2 && !isTrip(p, last - 1)) {
    put(last - 1, pick([['snare', 'snare', 'snare', 'snare'], ['snare', 0, 'snare', 'snare'], ['snare', 'snare', 'tom1', 'tom1']]));
  }
  return put(last, pick([['snare', 'snare', 'tom1', 'floor'], ['tom1', 'tom1', 'floor', 'floor'], ['snare', 'snare', 'snare', 'snare'], ['tom1', 'tom2', 'floor', 0]]));
}

/**
 * A chart to sight-read: a groove, a small variation, the groove again, then a
 * fill. `gen` is a level (0–2) or a style id, as for randomGroove.
 * With repeat, the fourth bar becomes a first ending and the fill a second
 * ending, so the chart is five bars written and eight bars played.
 */
export function randomChart(gen = 0, { nBars = 4, repeat = false } = {}) {
  const simple = typeof gen === 'number'; // plain 4/4, where a kick can move freely
  const level = simple ? gen : 1;
  let base = randomGroove(gen);
  for (let i = 0; i < 20 && base.pattern.tom1.some(Boolean); i++) base = randomGroove(gen); // the fill comes later
  const A = base.pattern;
  const B = simple && chance(level === 0 ? 0.5 : 0.85) ? varyKick(A, level) : A;
  const bars = Array.from({ length: nBars }, (_, i) => clonePattern(i % 2 ? B : A));
  addFill(bars[nBars - 1], level);
  if (level >= 1) {
    // A crash on beat 1 marks the top of the chart.
    for (const id of ['hihat', 'ride']) bars[0][id][0] = 0;
    bars[0].crash[0] = NOTE.HIT;
  }
  const label = simple ? LEVEL_NAMES[gen] : STYLES.find((s) => s.id === gen)?.name || '';
  if (repeat) {
    // First ending: a lighter fill that leads back to the top.
    const first = clonePattern(A);
    addFill(first, Math.max(0, level - 1));
    const n = bars.length;
    bars.splice(n - 1, 0, first);
    const head = Array.from({ length: n - 1 }, (_, i) => i);
    return { name: `${label} repeat chart`.trim(), bars, order: [...head, n - 1, ...head, n], endings: [n - 1, n] };
  }
  return { name: `${label} chart`.trim(), bars };
}

/**
 * A 16-bar chart in four phrases of four bars: the groove twice, a contrasting
 * section (the hands often move to the ride), then the groove again. Every
 * phrase ends in a fill, the last one the biggest.
 */
export function randomLongChart(gen = 0) {
  const simple = typeof gen === 'number';
  const level = simple ? gen : 1;
  let base = randomGroove(gen);
  for (let i = 0; i < 20 && base.pattern.tom1.some(Boolean); i++) base = randomGroove(gen);
  const A = base.pattern;
  const B = simple && chance(0.85) ? varyKick(A, level) : A;
  const C = simple ? varyKick(A, level) : clonePattern(A);
  if (level >= 1 && C.hihat.some(Boolean) && !C.ride.some(Boolean)) {
    C.ride = C.hihat.map((v) => (v ? NOTE.HIT : 0));
    C.hihat = C.hihat.map(() => 0);
  }
  const light = Math.max(0, level - 1);
  const phrase = (x, y, fill) => {
    const four = [x, y, x, y].map(clonePattern);
    addFill(four[3], fill);
    return four;
  };
  const bars = [...phrase(A, B, light), ...phrase(A, B, level), ...phrase(C, C, light), ...phrase(A, B, level)];
  if (level >= 1) {
    // A crash marks the top of the chart and each change of section.
    for (const n of [0, 8, 12]) {
      for (const id of ['hihat', 'ride']) bars[n][id][0] = 0;
      bars[n].crash[0] = NOTE.HIT;
    }
  }
  const label = simple ? LEVEL_NAMES[gen] : STYLES.find((s) => s.id === gen)?.name || '';
  return { name: `${label} 16-bar chart`.trim(), bars };
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
      const v = p.snare[12];
      p.snare[12] = 0;
      p.snare[pick(level === 0 ? [10, 14] : [10, 14, 11, 13])] = v;
      return true;
    },
    () => { // change the hands' rhythm
      if (!hand) return false;
      const cur = p[hand].filter(Boolean).length;
      const next = level === 0 ? (cur > 4 ? Q : E) : cur > 8 ? E : S;
      const fill = p.tom1.some(Boolean);
      const old = p[hand];
      p[hand] = Array(STEPS).fill(0);
      for (const s of next) if (!fill || s < 12) p[hand][s] = old[s] || 1;
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
