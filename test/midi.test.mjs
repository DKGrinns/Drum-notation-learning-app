// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../public/js/midi.js';

const NOTE_ON = 0x99; // note-on, channel 10
const hits = [];
M.onMidiHit((h) => hits.push(h));
const send = (note, velocity = 100, status = NOTE_ON) => {
  hits.length = 0;
  M.handleMessage([status, note, velocity], 1000);
  return hits[0];
};

test('every pad zone of a Roland TD-17KVX reaches the right drum', () => {
  const kit = {
    kick: [36],
    snare: [38, 40, 37], // head, rim, cross-stick
    tom1: [48, 50],
    tom2: [45, 47],
    floor: [43, 58],
    hihat: [42, 22, 46, 26], // VH-10: closed bow/edge, open bow/edge
    crash: [49, 55, 57, 52], // crash 1 and 2, bow and edge
    ride: [51, 59, 53], // bow, edge, bell
    hhfoot: [44], // the pedal closing
  };
  for (const [id, notes] of Object.entries(kit)) for (const n of notes) assert.equal(send(n)?.id, id, `note ${n}`);
});

test('open and closed hi-hat are told apart', () => {
  assert.equal(send(46).open, true);
  assert.equal(send(26).open, true);
  assert.equal(send(42).open, false);
  assert.equal(send(22).open, false);
});

test('note-offs, spare pads and other messages are not hits', () => {
  assert.equal(send(27), undefined); // aux pad: heard, not used
  assert.equal(send(38, 0), undefined); // note-on with no force is a note-off
  assert.equal(send(38, 64, 0x89), undefined); // note-off
  assert.equal(send(4, 90, 0xb9), undefined); // hi-hat pedal position
  assert.equal(send(100), undefined); // a note no drum uses
});

test('hits carry how hard they were played and when', () => {
  const h = send(38, 23);
  assert.equal(h.velocity, 23);
  assert.equal(h.ts, 1000);
  assert.equal(h.source, 'midi');
});

test('hit-to-learn moves a note to another drum, and reset restores it', () => {
  M.assignNotes('snare', [60, 61]);
  assert.equal(send(60).id, 'snare');
  assert.equal(send(38), undefined); // the old snare notes were replaced
  M.assignNotes('ride', [60]);
  assert.equal(send(60).id, 'ride');
  assert.deepEqual(M.notesFor('snare'), [61]);
  M.resetMap();
  assert.equal(send(38).id, 'snare');
  assert.equal(send(60), undefined);
});
