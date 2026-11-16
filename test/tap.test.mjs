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

test('a flam played as two strokes is one note, timed by the second stroke', () => {
  const { pattern } = makeGroove('', { snare: [4], flam: { snare: [0, 8, 12] } });
  const s = session({ pattern, ids: ['snare'] });
  const play = (slot, late, velocity) => s.hit('snare', at(pattern, slot, 0, late), 'midi', { velocity });
  play(0, -0.03, 40); // grace note just before the beat
  assert.equal(play(0, 0, 100), 'good'); // main stroke on the beat
  play(4, 0, 90);
  play(8, 0, 95); // a flam played as a single stroke
  play(12, -0.03, 40);
  play(12, 0.2, 90); // far too late to be the same flam
  const r = s.result();
  assert.equal(r.extras, 1);
  assert.equal(r.on, 4);
  assert.deepEqual(r.expression.flams, { ok: 1, total: 3 });
});

test('drags, rolls and ties: extra strokes are part of the note, and a tie is not played', () => {
  const { pattern } = makeGroove('', { snare: [0, 4, 8, 12], tie: { snare: [4] }, drag: { snare: [8] }, roll: { snare: [12] } });
  const s = session({ pattern, ids: ['snare'] });
  const play = (slot, late, note = 38) => s.hit('snare', at(pattern, slot, 0, late), 'midi', { velocity: 80, note });
  play(0, 0);
  play(8, -0.06);
  play(8, -0.03);
  assert.equal(play(8, 0), 'good'); // two grace strokes, then the main one on the beat
  for (let i = 0; i < 6; i++) play(12, i * 0.04); // a roll: six quick strokes
  const r = s.result();
  assert.deepEqual([r.on, r.missed, r.extras], [3, 0, 0]); // three notes to play: the tied one isn't one of them
  assert.deepEqual(r.expression.drags, { ok: 1, total: 1 });
  assert.deepEqual(r.expression.rolls, { ok: 1, total: 1 });
});

test('a cross-stick and a ride bell are recognised by the note the kit sends', () => {
  const { pattern } = makeGroove('', { ride: [0, 4, 8, 12], bell: { ride: [0, 8] }, cross: { snare: [4, 12] } });
  const s = session({ pattern, ids: ['ride', 'snare'] });
  const play = (id, slot, note) => s.hit(id, at(pattern, slot), 'midi', { velocity: 90, note });
  play('ride', 0, 53); // bell
  play('ride', 8, 51); // bow, where the bell was written
  play('ride', 4, 51);
  play('ride', 12, 51);
  play('snare', 4, 37); // cross-stick
  play('snare', 12, 38); // a normal snare hit instead
  const r = s.result();
  assert.equal(r.score, 100);
  assert.deepEqual(r.expression.bells, { ok: 1, total: 2 });
  assert.deepEqual(r.expression.crosses, { ok: 1, total: 2 });
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
