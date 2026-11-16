// Replay a diagnostics file through the scoring code.
// Usage: node scripts/replay.mjs path/to/drum-reader-diagnostics-….json
//
// For each recorded run it re-scores the recorded hits and prints the timing and
// how hard each kind of note was played, then summarises the kit's raw messages.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { tapSession } from '../public/js/tap.js';
import { DEFAULT_MAP, noteName } from '../public/js/midi.js';

const TYPE = { 1: 'normal', 2: 'accent', 3: 'ghost', 4: 'open', 5: 'flam', 6: 'cross-stick', 7: 'bell' };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const median = (a) => (a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : 0);

/** Score a recorded run again. Returns { result, session }. */
export function replayRun(run) {
  const session = tapSession({
    pattern: run.single ? run.bars[0] : undefined,
    bars: run.single ? undefined : run.bars,
    order: run.order || undefined,
    ids: run.ids, loops: run.loops, startTime: run.startTime, sixteenth: run.sixteenth,
    toAudioTime: (t) => t, // recorded times are already audio times, corrected for the offsets
  });
  for (const tap of run.taps) session.hit(tap.id, tap.t, tap.src, { velocity: tap.vel, open: tap.open, note: tap.note });
  return { result: session.result(), session };
}

function describeRun(run, i) {
  const { result, session } = replayRun(run);
  const same = result.score === run.result.score;
  console.log(`\nRun ${i + 1}: ${run.label || '(no label)'}  —  ${new Date(run.at).toLocaleString()}`);
  console.log(`  score ${result.score}%${same ? '' : `  (was ${run.result.score}% when recorded: scoring has changed)`}  on ${result.on}  early ${result.early}  late ${result.late}  missed ${result.missed}  extra ${result.extras}`);
  for (const id of run.ids) {
    const hit = session.expected.filter((e) => e.id === id && e.hit);
    if (!hit.length) continue;
    const ms = hit.map((e) => e.d * 1000);
    const spread = median(ms.map((d) => Math.abs(d - median(ms))));
    console.log(`  ${id.padEnd(6)} timing: mean ${mean(ms).toFixed(0).padStart(4)} ms, typical spread ±${spread.toFixed(0)} ms, ${hit.length} hits`);
    const byType = {};
    for (const e of hit) if (e.vel) (byType[TYPE[e.value]] ||= []).push(e.vel);
    const parts = Object.entries(byType).map(([t, v]) => `${t} ${Math.min(...v)}–${Math.max(...v)} (median ${median(v)})`);
    if (parts.length) console.log(`         strength: ${parts.join(', ')}`);
  }
  if (result.expression) console.log('  from the kit:', JSON.stringify(result.expression));
}

function describeEvents(events) {
  const midi = events.filter((e) => e.k === 'midi');
  const notes = {};
  let pedal = 0;
  for (const e of midi) {
    const [status, a, b] = e.m;
    if ((status & 0xf0) === 0x90 && b) (notes[a] ||= []).push(b);
    if ((status & 0xf0) === 0xb0 && a === 4) pedal++;
  }
  console.log(`\nKit messages: ${midi.length} (${pedal} hi-hat pedal position updates)`);
  for (const n of Object.keys(notes).map(Number).sort((x, y) => x - y)) {
    const v = notes[n];
    const to = DEFAULT_MAP[n] || 'NOT IN THE BUILT-IN MAP';
    console.log(`  note ${String(n).padStart(3)}  ×${String(v.length).padStart(4)}  strength ${Math.min(...v)}–${Math.max(...v)}  ${noteName(n)} → ${to}`);
  }
  for (const e of events.filter((x) => x.k === 'error')) console.log(`  ERROR ${new Date(e.at).toLocaleTimeString()}: ${e.text}`);
  for (const e of events.filter((x) => x.k === 'note')) console.log(`  note  ${new Date(e.at).toLocaleTimeString()}: ${e.text}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const file = process.argv[2];
  if (!file) {
    console.log('Usage: node scripts/replay.mjs <diagnostics file>');
    process.exit(1);
  }
  const report = JSON.parse(readFileSync(file, 'utf8'));
  if (report.app !== 'drum-reader-diagnostics') throw new Error('Not a Drum Reader diagnostics file');
  console.log(`Saved ${report.saved}`);
  console.log('Device:', JSON.stringify(report.device));
  console.log('Audio:', JSON.stringify(report.audio), ' Kit:', JSON.stringify(report.kit));
  console.log('Settings:', JSON.stringify({ ...report.settings, customKitMap: report.settings.customKitMap ? 'yes' : 'no' }));
  report.runs.forEach(describeRun);
  describeEvents(report.events);
}
