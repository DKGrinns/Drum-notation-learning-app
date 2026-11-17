// Electronic drum kit input over MIDI (USB or Bluetooth).
//
// Works in Chrome and Edge on Android, Windows, Mac and Chromebooks. Safari on
// iPhone and iPad has no MIDI support.
//
// Every e-kit sends a note number for each pad zone. Most follow the General
// MIDI drum map; Roland adds extra notes for rims, edges and hi-hat zones. The
// numbers don't clash, so one default map covers them all. It is written out in
// full for the Roland TD-17 (TD-17KVX with the VH-10 hi-hat), whose factory
// settings are the Roland lines below (checked against a published TD-17 note
// list: all 24 pad zones match). "Hit to learn" in the kit setup screen fixes
// anything a kit sends differently.
import { store } from './store.js';
import { byId } from './kit.js';
import { logEvent } from './diag.js';

/** A note the app hears but doesn't use (spare pad inputs). */
export const IGNORE = 'none';

// note number → [app drum, what it is on the kit, 'open' for an open hi-hat]
const NOTES = {
  // Kick (KD-10)
  36: ['kick', 'Kick'],
  35: ['kick', 'Kick (second sound)'],
  // Snare (PDX-12)
  38: ['snare', 'Snare head'],
  40: ['snare', 'Snare rim'],
  37: ['snare', 'Snare cross-stick'],
  // Toms (PDX-8 ×3): head and rim
  48: ['tom1', 'Tom 1 head'],
  50: ['tom1', 'Tom 1 rim'],
  45: ['tom2', 'Tom 2 head'],
  47: ['tom2', 'Tom 2 rim'],
  43: ['floor', 'Tom 3 (floor) head'],
  58: ['floor', 'Tom 3 (floor) rim'],
  41: ['floor', 'Low floor tom'],
  // Hi-hat (VH-10): bow and edge, open and closed, plus the pedal
  42: ['hihat', 'Hi-hat closed, bow'],
  22: ['hihat', 'Hi-hat closed, edge'],
  46: ['hihat', 'Hi-hat open, bow', 'open'],
  26: ['hihat', 'Hi-hat open, edge', 'open'],
  44: ['hhfoot', 'Hi-hat pedal (foot close)'],
  // Crash 1 and crash 2 (CY-12C): bow and edge
  49: ['crash', 'Crash 1 bow'],
  55: ['crash', 'Crash 1 edge'],
  57: ['crash', 'Crash 2 bow'],
  52: ['crash', 'Crash 2 edge'],
  // Ride (CY-13R): bow, edge and bell
  51: ['ride', 'Ride bow'],
  59: ['ride', 'Ride edge'],
  53: ['ride', 'Ride bell'],
  // Extra pad inputs on Roland modules
  27: [IGNORE, 'Aux pad head'],
  28: [IGNORE, 'Aux pad rim'],
};

export const DEFAULT_MAP = Object.fromEntries(Object.entries(NOTES).map(([n, v]) => [n, v[0]]));
const HH_PEDAL_CC = 4; // the hi-hat pedal's position: 0 = open … 127 = closed (Roland)

/** What a note is called on the kit, e.g. "Snare rim". */
export const noteName = (n) => NOTES[n]?.[1] || `Note ${n}`;

const S = {
  access: null,
  state: 'off', // off | starting | on | denied | unsupported
  map: null,
  hitFns: new Set(),
  rawFns: new Set(),
  changeFns: new Set(),
  pedal: 0,
};

export const midiSupported = () => typeof navigator !== 'undefined' && !!navigator.requestMIDIAccess;

function loadMap() {
  if (!S.map) {
    const saved = store.get('midi.map', null);
    S.map = saved && typeof saved === 'object' ? { ...saved } : { ...DEFAULT_MAP };
  }
  return S.map;
}

/** The note → drum map in use. */
export const midiMap = () => ({ ...loadMap() });
export const isDefaultMap = () => !store.get('midi.map', null);

/** Notes that play a drum, lowest first. */
export const notesFor = (id) => Object.keys(loadMap()).filter((n) => loadMap()[n] === id).map(Number).sort((a, b) => a - b);

/** Make these notes (and only these) play one drum. */
export function assignNotes(id, notes) {
  const map = loadMap();
  for (const n of Object.keys(map)) if (map[n] === id) delete map[n];
  for (const n of notes) map[n] = id;
  store.set('midi.map', map);
  emitChange();
}

export function resetMap() {
  S.map = { ...DEFAULT_MAP };
  store.set('midi.map', null);
  emitChange();
}

/** Timing correction for kit hits, in ms (positive: hits register late). */
export const midiOffset = () => store.get('midi.offset', 0);
export const setMidiOffset = (ms) => store.set('midi.offset', ms);
/**
 * Should the app make its own drum sound when you hit the kit? On unless switched
 * off: a kit's own sounds only come out of its module, so anyone listening through
 * the computer or phone would otherwise hear nothing when they play.
 */
export const midiSounds = () => !!store.get('midi.sounds', true);
export const setMidiSounds = (v) => store.set('midi.sounds', !!v);

/** The kits (MIDI inputs) plugged in right now. */
export function midiInputs() {
  return S.access ? [...S.access.inputs.values()].filter((i) => i.state !== 'disconnected').map((i) => i.name || 'MIDI device') : [];
}
export const midiState = () => S.state;

function emitChange() {
  for (const fn of S.changeFns) fn();
}

/** Turn one raw MIDI message into a hit. Exported so it can be tested. */
export function handleMessage(data, timeStamp) {
  const kind = data[0] & 0xf0;
  // Diagnostics: keep every message except the constant stream of clock ticks.
  if (data[0] < 0xf0) logEvent('midi', { m: [data[0], data[1], data[2]], ts: Math.round((timeStamp || 0) * 10) / 10 });
  if (kind === 0xb0 && data[1] === HH_PEDAL_CC) {
    S.pedal = data[2];
    return;
  }
  if (kind !== 0x90 || !data[2]) return; // only note-on with some force
  const note = data[1];
  const velocity = data[2];
  const ts = timeStamp || performance.now();
  for (const fn of S.rawFns) fn({ note, velocity, ts });
  const id = loadMap()[note];
  if (!id || id === IGNORE || !byId[id]) return;
  const hit = { id, ts, velocity, note, open: NOTES[note]?.[2] === 'open', source: 'midi' };
  for (const fn of S.hitFns) fn(hit);
}

function attach() {
  for (const input of S.access.inputs.values()) input.onmidimessage = (e) => handleMessage(e.data, e.timeStamp);
}

/** Ask the browser for MIDI and start listening. Resolves to the new state. */
export async function enableMidi() {
  if (!midiSupported()) {
    S.state = 'unsupported';
    emitChange();
    return S.state;
  }
  if (S.state === 'on' || S.state === 'starting') return S.state;
  S.state = 'starting';
  emitChange();
  try {
    S.access = await navigator.requestMIDIAccess();
    logEvent('note', { text: `MIDI on: ${[...S.access.inputs.values()].map((i) => `${i.manufacturer || '?'} ${i.name}`).join('; ') || 'no inputs'}` });
    S.access.onstatechange = () => {
      attach();
      emitChange();
    };
    attach();
    S.state = 'on';
    store.set('midi.on', true);
  } catch (err) {
    S.state = 'denied';
    logEvent('error', { text: `MIDI access failed: ${err?.message || err}` });
  }
  emitChange();
  return S.state;
}

export function disableMidi() {
  if (S.access) for (const input of S.access.inputs.values()) input.onmidimessage = null;
  S.access = null;
  S.state = 'off';
  store.set('midi.on', false);
  emitChange();
}

/** If you connected a kit before, reconnect quietly when the app opens. */
export function resumeMidi() {
  if (store.get('midi.on', false) && midiSupported()) enableMidi();
}

const sub = (set) => (fn) => {
  set.add(fn);
  return () => set.delete(fn);
};
/** Hits on mapped drums: fn({ id, ts, velocity, note, open, source }). Returns an unsubscribe function. */
export const onMidiHit = sub(S.hitFns);
/** Every note the kit sends, mapped or not: fn({ note, velocity, ts }). */
export const onMidiNote = sub(S.rawFns);
/** Kits plugged in or unplugged, state or map changes. */
export const onMidiChange = sub(S.changeFns);
