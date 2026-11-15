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

test('the recording keeps the raw kit messages, including ones no drum uses', () => {
  const notes = report.events.filter((e) => e.k === 'midi').map((e) => e.m[1]);
  assert.ok(notes.includes(99));
  assert.ok(report.events.some((e) => e.k === 'error'));
});
