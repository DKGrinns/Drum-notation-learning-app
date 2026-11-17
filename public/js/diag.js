// Diagnostics: an optional recording of what the kit sent and how each run was
// scored, saved as a file you can send to whoever is working on the app.
//
// Off by default. Nothing leaves the device unless you save the file yourself.
// It holds data only (no sound), and only the most recent events and runs.
import { store } from './store.js';

const MAX_EVENTS = 3000; // kit messages and errors
const MAX_RUNS = 30; // scored runs

let events = null;
let runs = null;
let unsaved = 0;

function load() {
  if (events) return;
  const saved = store.get('diag.log', null);
  events = Array.isArray(saved?.events) ? saved.events : [];
  runs = Array.isArray(saved?.runs) ? saved.runs : [];
}

function persist() {
  unsaved = 0;
  store.set('diag.log', { events, runs });
}

export const diagOn = () => !!store.get('diag.on', false);
export function setDiagOn(v) {
  store.set('diag.on', !!v);
  if (v) logEvent('note', { text: 'Diagnostics switched on' });
}

/** Record one small event (a kit message, an error, a note). `kind` is a short word. */
export function logEvent(kind, data) {
  if (!diagOn()) return;
  load();
  events.push({ k: kind, at: Date.now(), ...data });
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  if (++unsaved >= 100 || kind === 'error') persist();
}

/** Record one scored run in full, so it can be replayed later. */
export function logRun(run) {
  if (!diagOn()) return;
  load();
  runs.push({ at: Date.now(), ...run });
  if (runs.length > MAX_RUNS) runs.splice(0, runs.length - MAX_RUNS);
  persist();
}

export function diagCounts() {
  load();
  return { events: events.length, runs: runs.length };
}

export function clearDiag() {
  events = [];
  runs = [];
  persist();
}

/** Everything recorded, plus details of this device. `extra` is added by the caller (audio and kit details). */
export function diagReport(extra = {}) {
  load();
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const scr = typeof screen !== 'undefined' ? screen : {};
  return {
    app: 'drum-reader-diagnostics',
    version: 1,
    saved: new Date().toISOString(),
    device: {
      userAgent: nav.userAgent,
      platform: nav.userAgentData?.platform || nav.platform,
      language: nav.language,
      screen: `${scr.width}x${scr.height}`,
      pixelRatio: typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : undefined,
      touchPoints: nav.maxTouchPoints,
    },
    settings: {
      tapOffset: store.get('play.offset', 0),
      kitOffset: store.get('midi.offset', 0),
      calibrated: store.get('calibrated', false),
      customKitMap: store.get('midi.map', null),
      kitSounds: store.get('midi.sounds', true),
    },
    ...extra,
    runs,
    events,
  };
}

/** Download the report as a file. */
export function downloadDiag(extra) {
  persist();
  const url = URL.createObjectURL(new Blob([JSON.stringify(diagReport(extra))], { type: 'application/json' }));
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  a.href = url;
  a.download = `drum-reader-diagnostics-${stamp}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
