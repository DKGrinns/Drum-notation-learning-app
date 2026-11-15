// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGroove, slotPos } from '../public/js/grooves.js';
import { tapSession } from '../public/js/tap.js';

const SIX = 0.125; // a 16th at 120 BPM, in seconds
const E = [0, 2, 4, 6, 8, 10, 12, 14];
// In tests a timestamp is simply the audio time in ms.
const session = (o) => tapSession({ loops: 1, startTime: 1, sixteenth: SIX, toAudioTime: (ts) => ts / 1000, ...o });
const at = (pattern, slot, bar = 0, late = 0) => (1 + (bar * 16 + slotPos(pattern, slot)) * SIX + late) * 1000;

test('every note on time scores 100', () => {
  const { pattern } = makeGroove('', { hihat: E, snare: [4, 12], kick: [0, 8] });
  const s = session({ pattern, ids: ['hihat', 'snare', 'kick'] });
  for (const id of ['hihat', 'snare', 'kick']) pattern[id].forEach((v, slot) => v && assert.equal(s.hit(id, at(pattern, slot)), 'good'));
  const r = s.result();
  assert.equal(r.score, 100);
  assert.equal(r.missed, 0);
  assert.equal(r.expression, null); // no kit, so nothing about dynamics
});

test('late, missed and extra taps lower the score', () => {
  const { pattern } = makeGroove('', { snare: [0, 4, 8, 12] });
  const s = session({ pattern, ids: ['snare'] });
  assert.equal(s.hit('snare', at(pattern, 0)), 'good');
  assert.equal(s.hit('snare', at(pattern, 4, 0, 0.09)), 'ok'); // 90 ms late
  assert.equal(s.hit('snare', at(pattern, 6)), 'bad'); // nothing is written there
  const r = s.result();
  assert.deepEqual([r.on, r.late, r.missed, r.extras], [1, 1, 2, 1]);
  assert.equal(r.score, Math.round((100 * (1 + 0.5 - 0.25)) / 4));
  assert.equal(r.colors['snare:8'], 'var(--red)');
});

test('a chart with a repeat expects each bar as often as it is played', () => {
  const a = makeGroove('', { snare: [0] }).pattern;
  const b = makeGroove('', { snare: [0, 8] }).pattern;
  const s = session({ bars: [a, b], order: [0, 1, 0], ids: ['snare'] });
  let n = 0;
  [a, b, a].forEach((p, bar) => p.snare.forEach((v, slot) => v && (n++, s.hit('snare', at(p, slot, bar)))));
  const r = s.result();
  assert.equal(n, 4);
  assert.equal(r.score, 100);
  assert.equal(r.colors['1:snare:8'], 'var(--green)');
});

test('kit hits are checked for accents, ghost notes and open hi-hat', () => {
  const { pattern } = makeGroove('', {
    hihat: [0, 2, 4, 6, 8, 10, 12], open: { hihat: [14] }, accent: { hihat: [0, 8] },
    snare: [4, 12], ghost: { snare: [7, 15] }, kick: [0, 8],
  });
  const s = session({ pattern, ids: ['hihat', 'snare', 'kick'] });
  const play = (id, slot, velocity, open = false) => s.hit(id, at(pattern, slot), 'midi', { velocity, open });
  for (const slot of [2, 4, 6, 10, 12]) play('hihat', slot, 70);
  play('hihat', 0, 100); // accent, clearly louder: right
  play('hihat', 8, 72); // accent played like the rest: wrong
  play('hihat', 14, 80, true); // open hi-hat: right
  play('snare', 4, 100);
  play('snare', 12, 104);
  play('snare', 7, 30); // ghost, soft: right
  play('snare', 15, 95); // ghost played loud: wrong
  play('kick', 0, 90);
  play('kick', 8, 90);
  const r = s.result();
  assert.equal(r.score, 100); // timing is scored on its own
  assert.deepEqual(r.expression.accents, { ok: 1, total: 2 });
  assert.deepEqual(r.expression.ghosts, { ok: 1, total: 2 });
  assert.deepEqual(r.expression.opens, { ok: 1, total: 1 });
  assert.deepEqual(r.expression.closed, { ok: 7, total: 7 });
});
