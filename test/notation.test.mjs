// Run with: npm test
// The staff is drawn as SVG. These tests draw into a tiny stand-in for the page
// and check what came out: the right shapes, in the right order, with no broken numbers.
import test from 'node:test';
import assert from 'node:assert/strict';

/** A minimal element: remembers its tag, attributes and children. */
function node(tag) {
  return {
    tag, attrs: {}, children: [], style: {}, textContent: '', className: '',
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k]; },
    appendChild(c) { this.children.push(c); return c; },
    append(...cs) { this.children.push(...cs); },
    replaceChildren(...cs) { this.children = cs; },
    scrollTo() {},
    getBBox() { throw new Error('not rendered'); },
  };
}
globalThis.document = { createElementNS: (_, tag) => node(tag), createElement: (tag) => node(tag) };

const G = await import('../public/js/grooves.js');
const { renderPattern, renderChart } = await import('../public/js/notation.js');

const host = (width = 360) => ({ ...node('div'), clientWidth: width });
/** Every element under a node, flattened. */
const all = (n) => [n, ...n.children.flatMap(all)];
const tags = (n, tag) => all(n).filter((e) => e.tag === tag);
const texts = (n, cls) => tags(n, 'text').filter((e) => e.attrs.class === cls).map((e) => e.textContent);
const draw = (spec, opts = {}) => {
  const h = host(opts.width);
  const staff = renderPattern(h, { pattern: G.makeGroove('', spec).pattern, ...opts });
  return { h, staff };
};
/** No attribute may hold a broken number. */
function assertClean(n, label) {
  for (const e of all(n)) {
    for (const [k, v] of Object.entries(e.attrs)) assert.ok(!/NaN|undefined|Infinity/.test(v), `${label}: <${e.tag} ${k}="${v}">`);
  }
}
const E = [0, 2, 4, 6, 8, 10, 12, 14];

test('every preset draws cleanly at phone and tablet widths', () => {
  for (const p of G.PRESETS) {
    for (const width of [300, 360, 760]) {
      for (const layout of ['natural', 'grid']) {
        const { h } = draw(p.spec, { width, layout });
        assertClean(h, `${p.name} at ${width}px (${layout})`);
      }
    }
  }
});

test('random grooves and charts draw cleanly', () => {
  for (const gen of [0, 1, 2, ...G.STYLES.map((s) => s.id)]) {
    for (let i = 0; i < 25; i++) {
      const h = host();
      renderPattern(h, { pattern: G.randomGroove(gen).pattern });
      assertClean(h, `random groove ${gen}`);
    }
    for (const chart of [G.randomChart(gen), G.randomChart(gen, { repeat: true }), G.randomLongChart(gen)]) {
      const h = host(340);
      renderChart(h, { bars: chart.bars, endings: chart.endings });
      assertClean(h, `chart ${chart.name}`);
    }
  }
});

test('one notehead is drawn for each note', () => {
  const heads = (spec) => tags(draw(spec).h, 'ellipse').length;
  assert.equal(heads({ snare: [0, 4, 8, 12] }), 4);
  assert.equal(heads({ snare: E, kick: [0, 8] }), 10);
  assert.equal(heads({ snare: [0, 4], flam: { snare: [8] }, drag: { snare: [12] } }), 4 + 1 + 2); // plus the small grace notes
});

test('notes run left to right in time, inside the staff', () => {
  for (const spec of [{ snare: [...Array(16).keys()] }, { trip: [0, 1, 2, 3], snare: [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14] }, { meter: '6/8', snare: [0, 1, 2, 4, 5, 6] }, { meter: '5/4', snare: [0, 2, 4, 8, 12, 16, 18] }, { meter: '7/8', snare: [0, 2, 4, 6, 8, 9, 10] }]) {
    for (const layout of ['natural', 'grid']) {
      const { staff } = draw(spec, { layout });
      const p = G.makeGroove('', spec).pattern;
      const xs = p.snare.map((v, slot) => (v ? staff.xOf(slot) : null)).filter((x) => x != null);
      for (let i = 1; i < xs.length; i++) assert.ok(xs[i] > xs[i - 1] + 4, `${JSON.stringify(spec)} (${layout}): notes ${i - 1} and ${i} overlap`);
      assert.ok(xs[0] > 50 && xs[xs.length - 1] < 360 - 10);
    }
  }
});

test('the grid layout spaces the columns of a beat evenly', () => {
  const { staff } = draw({ snare: [...Array(16).keys()] }, { layout: 'grid' });
  const step = staff.xOf(1) - staff.xOf(0);
  for (const slot of [1, 2, 5, 6, 13, 14]) assert.ok(Math.abs(staff.xOf(slot + 1) - staff.xOf(slot) - step) < 0.01);
  assert.ok(staff.xOf(4) - staff.xOf(3) > step); // a gap between beats
});

test('triplets, stickings and time signatures are labelled', () => {
  const trip = draw({ trip: [1, 3], snare: [0, 4, 5, 6, 8, 12, 13, 14] }).h;
  assert.deepEqual(texts(trip, 'tuplet'), ['3', '3']);
  const stick = draw({ snare: [0, 4, 8, 12], sticking: { R: [0, 8], L: [4, 12] } }).h;
  assert.deepEqual(texts(stick, 'sticking'), ['R', 'L', 'R', 'L']);
  for (const [meter, top, bottom] of [['3/4', '3', '4'], ['5/4', '5', '4'], ['6/8', '6', '8'], ['12/8', '12', '8'], ['7/8', '7', '8']]) {
    assert.deepEqual(texts(draw({ meter, snare: [0] }).h, 'timesig'), [top, bottom]);
  }
});

test('in 7/8 every 8th note gets the same room on the grid', () => {
  const { h, staff } = draw({ meter: '7/8', snare: [0, 2, 4, 6, 8, 9, 10] }, { layout: 'grid', res: 2 });
  const xs = [0, 2, 4, 6, 8, 9, 10].map((s) => staff.xOf(s));
  const step = xs[1] - xs[0];
  assert.ok(Math.abs(xs[5] - xs[4] - step) < 0.01 && Math.abs(xs[6] - xs[5] - step) < 0.01);
  assert.deepEqual(texts(h, 'tuplet'), []); // three real 8ths, not a triplet
});

test('32nd notes get three beams and a sextuplet gets a 6', () => {
  const beams = (spec) => tags(draw(spec, { width: 760 }).h, 'rect').filter((e) => !e.attrs.class && Number(e.attrs.height) < 8 && Number(e.attrs.width) > 8).length;
  // Four 16ths: one long beam and one second beam between each pair = 1 + 3.
  assert.equal(beams({ snare: [0, 1, 2, 3] }), 4);
  // Eight 32nds: one long beam, then seven joins on each of the two inner levels.
  assert.equal(beams({ snare: [0, 1, 2, 3], fine: [0], x: { snare: [0, 1, 2, 3] } }), 1 + 7 + 7);
  const six = draw({ trip: [0], fine: [0], snare: [0, 1, 2], x: { snare: [0, 1, 2] } }).h;
  assert.deepEqual(texts(six, 'tuplet'), ['6']);
  assert.equal(tags(six, 'ellipse').length, 6);
  for (const layout of ['natural', 'grid']) {
    const { h, staff } = draw({ snare: [0, 1, 2, 3], fine: [0], x: { snare: [0, 1, 2, 3] } }, { layout });
    assertClean(h, `32nds (${layout})`);
    const xs = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((sl) => staff.xOf(sl));
    for (let i = 1; i < xs.length; i++) assert.ok(xs[i] > xs[i - 1] + 2, `32nds ${i - 1} and ${i} overlap (${layout})`);
  }
});

test('a chart wraps onto lines and labels its endings', () => {
  const chart = G.randomChart(0, { repeat: true });
  const h = host(340);
  const staff = renderChart(h, { bars: chart.bars, endings: chart.endings, full: true });
  assert.ok(staff.lines >= 2 && staff.lines <= 5);
  assert.deepEqual(texts(h, 'ending'), ['1.', '2.']);
  const wide = renderChart(host(1000), { bars: G.randomLongChart(0).bars });
  assert.equal(wide.lines, 4); // sixteen bars, four to a line
});

test('the playhead follows the slot it is given', () => {
  const { h, staff } = draw({ snare: E });
  const playhead = tags(h, 'rect').find((e) => e.attrs.class === 'playhead');
  staff.setPlayhead(4);
  const at4 = Number(playhead.attrs.x);
  staff.setPlayhead(12);
  assert.ok(Number(playhead.attrs.x) > at4);
  staff.setPlayhead(null);
  assert.equal(playhead.attrs.x, '-999');
});
