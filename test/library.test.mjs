// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGroove } from '../public/js/grooves.js';
import { encodeGroove, decodeGroove, grooveToMidi, fileName } from '../public/js/library.js';

const E = [0, 2, 4, 6, 8, 10, 12, 14];

test('a groove survives a trip through a share link', () => {
  const a = makeGroove('', { hihat: E, open: { hihat: [14] }, snare: [4], flam: { snare: [12] }, ghost: { snare: [7] }, kick: [0, 8, 10], hhfoot: [4, 12] }).pattern;
  const b = makeGroove('', { ride: [0, 1, 2, 4, 5, 6, 8, 12], trip: [1, 1, 0, 0], snare: [4, 12], kick: [0, 8] }).pattern;
  const code = encodeGroove({ name: 'Café shuffle', bars: [a, b], bpm: 96 });
  assert.match(code, /^[\w-]+$/); // safe to put in a link
  assert.deepEqual(decodeGroove(code), { name: 'Café shuffle', bars: [a, b], bpm: 96 });
});

test('6/8 grooves are shared with their time signature', () => {
  const p = makeGroove('', { meter: '6/8', hihat: [0, 1, 2, 4, 5, 6], snare: [4], kick: [0] }).pattern;
  assert.deepEqual(decodeGroove(encodeGroove({ name: 'Six', bars: [p], bpm: 60 })).bars, [p]);
});

test('a broken or hostile link is refused, not loaded', () => {
  assert.equal(decodeGroove('not a groove'), null);
  assert.equal(decodeGroove(''), null);
  assert.equal(decodeGroove(btoa(JSON.stringify({ v: 1, b: Array(50).fill({}) }))), null); // far too many bars
  const odd = decodeGroove(btoa(JSON.stringify({ v: 1, n: 'x'.repeat(500), t: 99999, b: [{ snare: '9z1' }] })));
  assert.equal(odd.name.length, 40);
  assert.equal(odd.bpm, 220);
  assert.deepEqual(odd.bars[0].snare.slice(0, 3), [0, 0, 1]); // nonsense values are dropped
});

test('a MIDI file has the right header, tempo and notes', () => {
  const { pattern } = makeGroove('', { hihat: E, open: { hihat: [14] }, snare: [4], flam: { snare: [12] }, kick: [0, 8] });
  const bytes = [...grooveToMidi({ name: 'Rock', bars: [pattern], bpm: 120 })];
  assert.deepEqual(bytes.slice(0, 14), [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 1, 0xe0]);
  assert.equal(bytes.length, 22 + ((bytes[18] << 24) | (bytes[19] << 16) | (bytes[20] << 8) | bytes[21])); // track length is right
  const text = bytes.join(',');
  assert.ok(text.includes('255,81,3,7,161,32')); // 500000 microseconds per beat = 120 BPM
  assert.ok(text.includes('255,88,4,4,2')); // 4/4
  const ons = bytes.filter((b) => b === 0x99).length;
  assert.equal(ons, 8 + 2 + 2 + 1); // 8 hi-hats, 2 snares, 2 kicks, and the flam's grace note
  assert.ok(text.includes('153,46,96')); // the open hi-hat
  assert.deepEqual(bytes.slice(-3), [0xff, 0x2f, 0]);
});

test('file names are safe', () => {
  assert.equal(fileName('Rock Beat #1!', 'mid'), 'rock-beat-1.mid');
  assert.equal(fileName('///', 'png'), 'groove.png');
});
