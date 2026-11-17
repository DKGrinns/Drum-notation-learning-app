// Run with: npm test
// The Settings sheet and the app's defaults, drawn into a tiny stand-in for the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** A minimal element: remembers its tag, attributes, children and listeners. */
function node(tag) {
  const e = {
    tag, nodeType: 1, attrs: {}, children: [], style: { setProperty() {} }, className: '', dataset: {}, listeners: {}, isConnected: false,
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k]; },
    addEventListener(type, fn) { this.listeners[type] = fn; },
    append(...cs) { for (const c of cs) { this.children.push(c); c.isConnected = true; } },
    replaceChildren(...cs) { this.children = cs; },
    remove() { this.isConnected = false; },
    querySelector() { return null; },
    focus() {},
    get textContent() { return this.text ?? this.children.map((c) => c.textContent).join(''); },
    set textContent(v) { this.text = String(v); this.children = []; },
  };
  return e;
}
const body = node('body');
globalThis.document = {
  body,
  documentElement: node('html'),
  createElement: node,
  createTextNode: (text) => ({ tag: '#text', children: [], textContent: text }),
  addEventListener() {},
  removeEventListener() {},
  querySelectorAll: () => [],
};
globalThis.requestAnimationFrame = () => 0;

const { openSettings } = await import('../public/js/settings.js');
const { currentTheme, THEMES } = await import('../public/js/theme.js');

const all = (n) => [n, ...n.children.flatMap(all)];
const byClass = (n, cls) => all(n).filter((e) => e.className === cls);

test('Settings gathers every app-wide setting, in sections', () => {
  openSettings();
  const sheet = body.children.at(-1);
  assert.equal(all(sheet).find((e) => e.attrs.role === 'dialog').attrs['aria-label'], 'Settings');
  assert.deepEqual(byClass(sheet, 'section-label').map((e) => e.textContent), ['Sound', 'Play with', 'Timing', 'Appearance', 'Help', 'Backup']);
  const rows = all(sheet).filter((e) => e.className === 'row-main').map((e) => e.children[0].textContent);
  for (const name of ['Click volume', 'Drum volume', 'Electronic drum kit', 'Microphone', 'Calibrate tap timing', 'Tap offset', 'Look', 'Show the quick tour', 'Save a backup file', 'Restore from a backup']) {
    assert.ok(rows.includes(name), name);
  }
  // Every row that opens something can be pressed.
  for (const btn of byClass(sheet, 'row row-btn')) assert.equal(typeof btn.listeners.click, 'function');
});

test('a new user gets the Studio Gray look, and the page paints it before the app loads', () => {
  assert.equal(currentTheme().id, 'studio');
  assert.equal(currentTheme().name, 'Studio Gray');
  assert.ok(THEMES.some((t) => t.id === 'auto')); // Classic is still on offer
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /if \(!t\) t = "studio";/);
  assert.match(html, /id="navSettings"[^>]*aria-label="Settings"/);
});

test('a delay in the app’s drum sounds is explained only when it is long enough to notice', async () => {
  const { delayAdvice, outputDelayMs } = await import('../public/js/audio.js');
  assert.equal(delayAdvice(0), '');
  assert.equal(delayAdvice(20), '');
  assert.match(delayAdvice(50), /about 50 ms after you hit.*trail slightly/);
  assert.match(delayAdvice(52), /about 50 ms/); // rounded to the nearest 5
  assert.match(delayAdvice(80), /trail clearly/);
  assert.match(delayAdvice(220), /a long way.*Wireless headphones/);
  assert.match(delayAdvice(50), /scores are not affected/);
  assert.equal(outputDelayMs(), 0); // no sound has been played yet, so nothing is known
});

test('the offline copy of the app includes every script', () => {
  const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  for (const f of ['js/settings.js', 'js/tap.js', 'js/midi.js', 'js/theme.js']) assert.ok(sw.includes(`'${f}'`), f);
});
