// A short tour shown the first time the app opens (and again from Learn → Progress).
import { h, modal } from './ui.js';
import { store } from './store.js';
import { midiSupported } from './midi.js';

const PAGES = [
  { art: '♪', title: 'Welcome to Drum Reader',
    body: ['Learn to read drum music by playing it.', 'Start in **Learn**: each level teaches one new thing, then has you tap it out. Pass a level’s test to unlock the next.'] },
  { art: '▶', title: 'Play along',
    body: ['**Play** gives you grooves and whole charts to read. Tap the pads, use your keyboard, or play a real kit.', 'Afterwards every note is coloured: green on time, orange early or late, red missed.'] },
  { art: '🥁', title: 'Use your electronic kit',
    body: () => [midiSupported()
      ? 'Plug your kit in with a USB cable, then open **Play → Options → Electronic drum kit** and press Connect.'
      : 'Electronic kits need Chrome or Edge on Android, Windows, Mac or a Chromebook. This browser can’t connect to one.',
    'With a kit, accents, ghost notes and open hi-hats are checked too.'] },
  { art: '✓', title: 'Before your first run',
    body: ['Sound reaches your ears a little late, more so over wireless headphones. Run **Calibrate** once in Play so your scores are fair.', '**Build** lets you write your own grooves, **Quiz** drills the symbols, and **Listen** trains your ears.'] },
];

const rich = (str) => str.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? h('b', null, part) : part));

/** Open the tour. Closing it any way marks it as seen. */
export function openTour() {
  let i = 0;
  const body = h('div', { class: 'tour' });
  const sheet = modal({ title: 'Quick tour', content: body, onClose: () => store.set('tour.done', true) });
  const draw = () => {
    const p = PAGES[i];
    const last = i === PAGES.length - 1;
    const text = typeof p.body === 'function' ? p.body() : p.body;
    body.replaceChildren(
      h('div', { class: 'tour-art', 'aria-hidden': 'true' }, p.art),
      h('h2', null, p.title),
      ...text.map((t) => h('p', null, rich(t))),
      h('div', { class: 'tour-dots', 'aria-label': `Page ${i + 1} of ${PAGES.length}` }, PAGES.map((_, n) => h('i', { class: n === i ? 'on' : '' }))),
      h('button', {
        type: 'button', class: 'btn-primary',
        onClick: () => {
          if (last) return sheet.close();
          i++;
          draw();
        },
      }, last ? 'Start learning' : 'Next'),
    );
  };
  draw();
  return sheet;
}

/** Show the tour once, the first time the app is opened. */
export function maybeShowTour() {
  if (!store.get('tour.done', false)) openTour();
}
