// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replayRun } from '../scripts/replay.mjs';

// A diagnostics file recorded from a simulated kit run: snare 60 ms late,
// one kick missed, two ghost notes played too loud.
const report = JSON.parse(readFileSync(new URL('./fixtures/diag-sample.json', import.meta.url), 'utf8'));

test('replaying a recorded run gives the score it had when recorded', () => {
  const run = report.runs[0];
  const { result } = replayRun(run);
  assert.equal(result.score, run.result.score);
  assert.equal(result.missed, 1);
  assert.equal(result.late, 10); // every snare hit
  assert.deepEqual(result.expression.ghosts, { ok: 4, total: 6 });
});

// Two runs played on a real Roland TD-17 (the first time the app met a real kit).
const td17 = JSON.parse(readFileSync(new URL('./fixtures/diag-td17.json', import.meta.url), 'utf8'));

test('a run recorded on a real TD-17 replays to the score it was given', () => {
  const { result } = replayRun(td17.runs[0]);
  assert.equal(result.score, td17.runs[0].result.score);
  assert.equal(result.missed, 1);
});

test('the real chart run: a weak kick blip is ignored and the advice names what went wrong', () => {
  const run = td17.runs[1];
  assert.ok(run.taps.some((t) => t.id === 'kick' && t.vel === 11)); // the blip is in the recording
  const { result } = replayRun(run);
  assert.equal(result.extras, run.result.extras - 1); // the kick it used to push out now matches its note
  assert.equal(result.score, run.result.score);
  assert.match(result.tips[0], /came in a bar late/);
  assert.match(result.tips[1], /^Bar 1, the second time through, is where it slipped/);
});

test('the recording keeps the raw kit messages, including ones no drum uses', () => {
  const notes = report.events.filter((e) => e.k === 'midi').map((e) => e.m[1]);
  assert.ok(notes.includes(99));
  assert.ok(report.events.some((e) => e.k === 'error'));
});
