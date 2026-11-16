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

test('a chart without a repeat plays its bars in order', () => {
  assert.deepEqual(G.chartOrder(G.randomChart(0)), [0, 1, 2, 3]);
  assert.equal(G.normalizeChart({ bars: [G.emptyPattern()], order: [0, 5] }).order, undefined);
});

test('a damaged chart is rejected', () => {
  assert.equal(G.normalizeChart(null), null);
  assert.equal(G.normalizeChart({ bars: [] }), null);
  assert.equal(G.normalizeChart({ bars: [G.emptyPattern('4/4'), G.emptyPattern('3/4')] }), null);
});
