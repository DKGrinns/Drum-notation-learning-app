// Saved grooves: a small library, share links, and MIDI files.
// Nothing here touches the page, so it can be tested on its own.
import { KIT } from './kit.js';
import { NOTE, meterOf, slotPos, normalizeChart, clonePattern, repeatForm } from './grooves.js';
import { store } from './store.js';

const MAX_SAVED = 100;
const MAX_BARS = 16;
/** A repeat needs at least a bar to repeat and two endings. */
const canRepeat = (flag, bars) => !!flag && bars.length >= 3;
const cleanName = (n) => String(n || '').trim().slice(0, 40) || 'My groove';
const cleanBpm = (b) => Math.min(220, Math.max(40, Math.round(Number(b) || 90)));

/** A saved groove, checked and tidied: { id, name, bars, bpm, at } or null. */
function entry(raw) {
  const c = normalizeChart({ name: raw?.name, bars: raw?.bars });
  if (!c || c.bars.length > MAX_BARS) return null;
  const e = { id: String(raw.id || ''), name: cleanName(raw.name), bars: c.bars, bpm: cleanBpm(raw.bpm), at: Number(raw.at) || 0 };
  if (canRepeat(raw.repeat, c.bars)) e.repeat = true;
  return e;
}

/** A saved groove as a chart for playing: its bars, with the repeat written out if it has one. */
export const asChart = (e) => ({ name: e.name, bars: e.bars, ...(canRepeat(e.repeat, e.bars) ? repeatForm(e.bars.length) : {}) });

export const sameBars = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const hasNotes = (bars) => bars.some((p) => KIT.some((k) => p[k.id].some(Boolean)));

/** Every saved groove, newest first. */
export function loadLibrary() {
  const list = store.get('library', []);
  return (Array.isArray(list) ? list : []).map(entry).filter((e) => e && e.id);
}

/** Save a groove. One with the same name is replaced. Returns the saved entry. */
export function saveToLibrary({ name, bars, bpm, repeat }) {
  const e = entry({ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name, bars: bars.map(clonePattern), bpm, repeat, at: Date.now() });
  if (!e) return null;
  const rest = loadLibrary().filter((x) => x.name.toLowerCase() !== e.name.toLowerCase());
  store.set('library', [e, ...rest].slice(0, MAX_SAVED));
  return e;
}

export function deleteFromLibrary(id) {
  store.set('library', loadLibrary().filter((e) => e.id !== id));
}

/** Put a deleted groove back where it was. */
export function restoreToLibrary(e, index = 0) {
  const list = loadLibrary().filter((x) => x.id !== e.id);
  list.splice(index, 0, e);
  store.set('library', list);
}

// ---------- Share links ----------

const toB64 = (text) => btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = (code) => new TextDecoder().decode(Uint8Array.from(atob(code.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

/** A groove as a short piece of text that fits in a link. */
export function encodeGroove({ name, bars, bpm, repeat }) {
  const b = bars.map((p) => {
    const row = {};
    for (const k of KIT) if (p[k.id].some(Boolean)) row[k.id] = p[k.id].join('');
    if (p.trip) row.trip = p.trip.join('');
    if (p.long) row.long = 1;
    return row;
  });
  return toB64(JSON.stringify({ v: 1, n: cleanName(name), t: cleanBpm(bpm), m: meterOf(bars[0]).id, b, ...(canRepeat(repeat, bars) ? { r: 1 } : {}) }));
}

/** Read a groove back out of a link. Returns { name, bars, bpm }, or null if it isn't one. */
export function decodeGroove(code) {
  try {
    const o = JSON.parse(fromB64(String(code)));
    if (o?.v !== 1 || !Array.isArray(o.b) || o.b.length > MAX_BARS) return null;
    const digits = (s) => String(s).split('').map(Number);
    const bars = o.b.map((row) => {
      const p = { meter: o.m };
      for (const k of KIT) if (row[k.id]) p[k.id] = digits(row[k.id]);
      if (row.trip) p.trip = digits(row.trip);
      if (row.long) p.long = true;
      return p;
    });
    const c = normalizeChart({ bars });
    if (!c) return null;
    return { name: cleanName(o.n), bars: c.bars, bpm: cleanBpm(o.t), ...(canRepeat(o.r, c.bars) ? { repeat: true } : {}) };
  } catch {
    return null;
  }
}

// ---------- MIDI files ----------

/** General MIDI drum notes, which every drum program understands. */
const GM = { kick: 36, snare: 38, hihat: 42, hhfoot: 44, tom1: 48, tom2: 45, floor: 43, crash: 49, ride: 51 };
const VELOCITY = { [NOTE.HIT]: 96, [NOTE.ACCENT]: 122, [NOTE.GHOST]: 38, [NOTE.OPEN]: 96, [NOTE.FLAM]: 104 };
const QUARTER = 480; // ticks

/** A number in MIDI's variable-length form. */
function varLen(n) {
  const out = [n & 0x7f];
  while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
  return out;
}

/** The groove as a standard MIDI file (drums on channel 10), played through `loops` times. */
export function grooveToMidi({ name = '', bars: written, bpm = 90, repeat }, loops = 1) {
  // A repeat is written out in full, the way it is played.
  const bars = canRepeat(repeat, written) ? repeatForm(written.length).order.map((i) => written[i]) : written;
  const m = meterOf(bars[0]);
  // In 6/8 and 12/8 the beat is a dotted quarter.
  const beat = m.compound ? QUARTER * 1.5 : QUARTER;
  const barTicks = m.beats * beat;
  const notes = [];
  for (let n = 0; n < loops * bars.length; n++) {
    const p = bars[n % bars.length];
    for (const k of KIT) {
      p[k.id].forEach((v, slot) => {
        if (!v || !GM[k.id]) return;
        const t = n * barTicks + Math.round((slotPos(p, slot) * beat) / 4);
        const note = k.id === 'hihat' && v === NOTE.OPEN ? 46 : GM[k.id];
        if (v === NOTE.FLAM) notes.push({ t: Math.max(0, t - 30), note, vel: 45 });
        notes.push({ t, note, vel: VELOCITY[v] || 96 });
      });
    }
  }
  // Each note is switched on, then off a little later.
  const events = notes.flatMap((x) => [{ t: x.t, on: 1, bytes: [0x99, x.note, x.vel] }, { t: x.t + 20, on: 0, bytes: [0x89, x.note, 0] }])
    .sort((a, b) => a.t - b.t || a.on - b.on);
  const tempo = Math.round(60e6 / (bpm * (m.compound ? 1.5 : 1))); // microseconds per quarter note
  const title = [...new TextEncoder().encode(cleanName(name))];
  const track = [
    0, 0xff, 0x03, ...varLen(title.length), ...title,
    0, 0xff, 0x51, 3, (tempo >> 16) & 0xff, (tempo >> 8) & 0xff, tempo & 0xff,
    0, 0xff, 0x58, 4, m.top, Math.log2(m.bottom), m.compound ? 36 : 24, 8,
  ];
  let at = 0;
  for (const e of events) {
    track.push(...varLen(e.t - at), ...e.bytes);
    at = e.t;
  }
  const end = Math.max(at, loops * bars.length * barTicks); // finish on the bar line, so it loops cleanly
  track.push(...varLen(end - at), 0xff, 0x2f, 0);
  const u32 = (n) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
  return Uint8Array.from([
    0x4d, 0x54, 0x68, 0x64, ...u32(6), 0, 0, 0, 1, QUARTER >> 8, QUARTER & 0xff,
    0x4d, 0x54, 0x72, 0x6b, ...u32(track.length), ...track,
  ]);
}

/** A safe file name made from a groove's name. */
export const fileName = (name, ext) => `${cleanName(name).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'groove'}.${ext}`;
