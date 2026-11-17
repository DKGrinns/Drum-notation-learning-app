// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../public/js/grooves.js';

const GENS = [0, 1, 2, ...G.STYLES.map((s) => s.id)];
const roundTrip = (x) => JSON.parse(JSON.stringify(x));

test('every preset builds a groove with the right number of slots', () => {
  for (const p of G.PRESETS) {
    const g = G.makeGroove(p.name, p.spec);
    assert.equal(g.pattern.snare.length, G.barSlots(g.pattern), p.name);
    assert.ok(!G.isEmpty(g), p.name);
  }
});

test('random grooves survive being saved and loaded', () => {
  for (const gen of GENS) {
    for (let i = 0; i < 100; i++) {
      const g = G.randomGroove(gen);
      const back = G.normalizeGroove(roundTrip(g));
      assert.equal(G.patternKey(back.pattern), G.patternKey(g.pattern));
    }
  }
});

test('triplet and compound beats never use the fourth slot', () => {
  for (const gen of GENS) {
    for (let i = 0; i < 100; i++) {
      const p = G.randomGroove(gen).pattern;
      const ok = new Set(G.validSlots(p));
      for (const k of G.usedInstruments({ pattern: p })) p[k.id].forEach((v, s) => v && assert.ok(ok.has(s), `${gen} ${k.id}:${s}`));
    }
  }
});

test('the newer sight-reading styles each contain what they are named for', () => {
  const values = (p) => G.usedInstruments({ pattern: p }).flatMap((k) => p[k.id]);
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    const odd = G.randomGroove('odd').pattern;
    const m = G.meterOf(odd);
    seen.add(m.id);
    assert.ok(m.odd || m.id === '9/8', m.id);
    assert.equal(odd.kick[0], G.NOTE.HIT);
    assert.equal(G.usedInstruments({ pattern: odd }).filter((k) => ['hihat', 'ride'].includes(k.id)).length, 1);
    const hands = odd.hihat.some(Boolean) ? odd.hihat : odd.ride;
    assert.equal(hands.filter(Boolean).length, m.top, `${m.id}: one hand note on every 8th`);

    const rud = G.randomGroove('rudiments').pattern;
    assert.ok(values(rud).some((v) => v === G.NOTE.DRAG || v === G.NOTE.ROLL), 'a drag or a roll');
    assert.ok(rud.snare[4] && rud.snare[12], 'both backbeats are there');

    const fine = G.randomGroove('32nds').pattern;
    const b = fine.fine.indexOf(1);
    assert.ok(b >= 0 && b < 3, 'one beat is split, and not the last');
    assert.ok(G.allSlots(fine).some((s) => !Number.isInteger(s) && ['hihat', 'snare'].some((id) => G.noteAt(fine, id, s))), 'it has 32nd notes');
    assert.deepEqual(G.normalizeGroove(roundTrip({ pattern: fine })).pattern, fine);
  }
  assert.ok(seen.size >= 4, 'odd time comes in several meters');
});

test('charts have four bars in one meter and end in a fill', () => {
  for (const gen of GENS) {
    for (let i = 0; i < 100; i++) {
      const c = G.randomChart(gen);
      assert.equal(c.bars.length, 4);
      assert.ok(G.normalizeChart(roundTrip(c)), `chart for ${gen} loads back`);
      const last = c.bars[3];
      const lastBeat = (G.beatsOf(last) - 1) * 4;
      assert.ok(!last.hihat.slice(lastBeat).some(Boolean) && !last.ride.slice(lastBeat).some(Boolean), 'hands leave the cymbals for the fill');
      assert.ok(['snare', 'tom1', 'tom2', 'floor'].some((id) => last[id].slice(lastBeat).some(Boolean)), 'the fill has drums');
    }
  }
});

test('repeat charts are five bars written and eight bars played', () => {
  for (const gen of GENS) {
    for (let i = 0; i < 50; i++) {
      const c = G.randomChart(gen, { repeat: true });
      assert.equal(c.bars.length, 5);
      assert.deepEqual(c.order, [0, 1, 2, 3, 0, 1, 2, 4]);
      assert.deepEqual(c.endings, [3, 4]);
      const back = G.normalizeChart(roundTrip(c));
      assert.deepEqual(G.chartOrder(back), c.order);
      assert.deepEqual(back.endings, c.endings);
    }
  }
});

test('16-bar charts are sixteen bars in one meter with a fill ending each phrase', () => {
  for (const gen of [0, 1, 2, ...G.STYLES.map((s) => s.id)]) {
    for (let i = 0; i < 20; i++) {
      const c = G.randomLongChart(gen);
      assert.equal(c.bars.length, 16);
      assert.ok(G.normalizeChart(roundTrip(c)), `long chart for ${gen} loads back`);
      for (const n of [3, 7, 11, 15]) assert.notDeepEqual(c.bars[n], c.bars[n - 1], `bar ${n + 1} for ${gen} is a fill`);
    }
  }
});

test('a repeat makes the last two bars the first and second endings', () => {
  assert.deepEqual(G.repeatForm(5), { order: [0, 1, 2, 3, 0, 1, 2, 4], endings: [3, 4] });
  assert.deepEqual(G.repeatForm(3), { order: [0, 1, 0, 2], endings: [1, 2] });
});

test('7/8 is two ordinary beats and one that is three 8ths long', () => {
  const p = G.makeGroove('', { meter: '7/8', hihat: [0, 2, 4, 6, 8, 9, 10] }).pattern;
  assert.equal(G.barLength(p), 14); // seven 8ths = fourteen 16ths
  assert.deepEqual([0, 2, 4, 6, 8, 9, 10].map((s) => G.slotPos(p, s)), [0, 2, 4, 6, 8, 10, 12]); // every 8th is the same length
  assert.deepEqual([0, 2, 4, 6, 8, 9, 10].map((s) => G.countLabel(s, p)), ['1', '2', '3', '4', '5', '6', '7']);
  assert.equal(G.countLabel(1, p), '1 &');
  assert.deepEqual([0, 3.9, 4, 8, 13].map((pos) => G.beatAt(p, pos)), [0, 0, 1, 2, 2]);
  assert.equal(G.barLength(G.makeGroove('', {}).pattern), 16);
  assert.equal(G.barLength(G.makeGroove('', { meter: '6/8' }).pattern), 8);
});

test('7/8 and 5/8 can be grouped with the long beat anywhere', () => {
  // [meter, the slots of its 8th notes, where the beats start (in 16ths)]
  const cases = [
    ['7/8 (3+2+2)', [0, 1, 2, 4, 6, 8, 10], [0, 6, 10]],
    ['7/8 (2+3+2)', [0, 2, 4, 5, 6, 8, 10], [0, 4, 10]],
    ['5/8', [0, 2, 4, 5, 6], [0, 4]],
    ['5/8 (3+2)', [0, 1, 2, 4, 6], [0, 6]],
  ];
  for (const [meter, eighths, starts] of cases) {
    const p = G.makeGroove('', { meter, hihat: eighths }).pattern;
    const n = eighths.length;
    assert.equal(G.barLength(p), n * 2, meter);
    assert.deepEqual(eighths.map((s) => G.slotPos(p, s)), Array.from({ length: n }, (_, i) => i * 2), `${meter}: every 8th is the same length`);
    assert.deepEqual(eighths.map((s) => G.countLabel(s, p)), Array.from({ length: n }, (_, i) => String(i + 1)), `${meter}: counted in 8ths`);
    assert.deepEqual(starts.map((_, b) => G.beatStart(p, b)), starts, meter);
    assert.equal(G.validSlots(p).length, n + (G.beatsOf(p) - 1) * 2 + 0, `${meter}: a long beat has three slots, the others four`);
    assert.deepEqual(G.normalizeGroove(roundTrip({ pattern: p })).pattern, p);
  }
  assert.equal(G.METERS['7/8'].group, '2 + 2 + 3');
});

test('9/8 is three beats of three 8ths', () => {
  const p = G.makeGroove('', { meter: '9/8', hihat: [0, 1, 2, 4, 5, 6, 8, 9, 10] }).pattern;
  assert.equal(G.barLength(p), 12); // three dotted quarters, each as long as an ordinary beat
  assert.equal(G.isCompound(p), true);
  assert.deepEqual([0, 1, 2, 4, 8, 10].map((s) => G.countLabel(s, p)), ['1', '1 &', '1 a', '2', '3', '3 a']);
  assert.equal(G.validSlots(p).length, 9);
});

test('every preset is in a meter the app knows and has notes in it', () => {
  for (const pre of G.PRESETS) {
    const g = G.makeGroove(pre.name, pre.spec);
    assert.ok(!pre.spec.meter || G.METERS[pre.spec.meter], pre.name);
    assert.equal(G.meterOf(g.pattern).id, pre.spec.meter || '4/4', pre.name);
    assert.ok(!G.isEmpty(g), pre.name);
    for (const k of G.usedInstruments(g)) for (const s of g.pattern[k.id].keys()) if (g.pattern[k.id][s]) assert.ok(G.validSlots(g.pattern).includes(s), `${pre.name}: ${k.id} slot ${s}`);
  }
});

test('a finer beat holds 32nd notes, or a sextuplet on a triplet beat', () => {
  const p = G.makeGroove('', { snare: [0, 8, 9, 10, 11], fine: [2], x: { snare: [8, 9, 10, 11] } }).pattern;
  assert.deepEqual(G.allSlots(p).filter((s) => s >= 8 && s < 12), [8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5]);
  assert.deepEqual([8, 8.5, 9, 11.5].map((s) => G.slotPos(p, s)), [8, 8.5, 9, 11.5]); // a 32nd is half a 16th
  assert.equal(G.noteAt(p, 'snare', 9.5), G.NOTE.HIT);
  assert.equal(G.noteAt(p, 'snare', 0.5), 0); // beat 1 isn't split
  assert.deepEqual(G.normalizeGroove(roundTrip({ pattern: p })).pattern, p);
  assert.deepEqual(G.clonePattern(p), p);
  const six = G.makeGroove('', { trip: [0], fine: [0], snare: [0, 1, 2], x: { snare: [0, 1, 2] } }).pattern;
  assert.deepEqual(G.allSlots(six).slice(0, 6).map((s) => +G.slotPos(six, s).toFixed(3)), [0, 0.667, 1.333, 2, 2.667, 3.333]); // six even notes
  G.setNote(six, 'snare', 1.5, 0);
  assert.equal(G.noteAt(six, 'snare', 1.5), 0);
  assert.ok(G.usedInstruments({ pattern: G.makeGroove('', { fine: [0], x: { kick: [0] } }).pattern }).some((k) => k.id === 'kick'));
});

test('a chart without a repeat plays its bars in order', () => {
  assert.deepEqual(G.chartOrder(G.randomChart(0)), [0, 1, 2, 3]);
  assert.equal(G.normalizeChart({ bars: [G.emptyPattern()], order: [0, 5] }).order, undefined);
});

test('a damaged chart is rejected', () => {
  assert.equal(G.normalizeChart(null), null);
  assert.equal(G.normalizeChart({ bars: [] }), null);
  assert.equal(G.normalizeChart({ bars: [G.emptyPattern('4/4'), G.emptyPattern('3/4')] }), null);
});
