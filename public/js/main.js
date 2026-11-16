import { transport, unlockAudio } from './audio.js';
import { store } from './store.js';
import { resumeMidi } from './midi.js';
import { micWanted, enableMic } from './mic.js';
import { logEvent } from './diag.js';
import { maybeShowTour } from './tour.js';
import { decodeGroove } from './library.js';
import { toast } from './ui.js';

// Diagnostics: note anything that goes wrong inside the app.
window.addEventListener('error', (e) => logEvent('error', { text: `${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})` }));
window.addEventListener('unhandledrejection', (e) => logEvent('error', { text: `Promise: ${e.reason?.message || e.reason}` }));
import * as learn from './views/learn.js';
import * as build from './views/build.js';
import * as quiz from './views/quiz.js';
import * as listen from './views/listen.js';
import * as play from './views/play.js';

const VIEWS = { learn, build, quiz, listen, play };

const viewEl = document.getElementById('view');
const titleEl = document.getElementById('title');
const leftBtn = document.getElementById('navLeft');
const rightBtn = document.getElementById('navRight');

/** Lets a view put buttons in the navigation bar (left / right). */
const nav = {
  set({ left, right } = {}) {
    for (const [btn, cfg] of [[leftBtn, left], [rightBtn, right]]) {
      btn.hidden = !cfg;
      btn.textContent = cfg?.label || '';
      btn.onclick = cfg?.onClick || null;
    }
  },
  /**
   * Change the title (for views with their own screens). compact: a small title
   * centered in the bar instead of the large title, like a pushed iOS screen.
   */
  title(text, { compact = false } = {}) {
    titleEl.textContent = text;
    navTitleEl.textContent = text;
    document.body.classList.toggle('compact', compact);
    document.title = `${text} · Drum Reader`;
    fitNavTitle();
    onScroll();
  },
};
const navTitleEl = document.getElementById('navTitle');

/** Like iOS: once the large title scrolls away, its small version fades into the bar. */
function onScroll() {
  const past = window.scrollY > titleEl.offsetTop + titleEl.offsetHeight - 50;
  document.body.classList.toggle('scrolled', window.scrollY > 2);
  document.body.classList.toggle('title-hidden', past);
}
window.addEventListener('scroll', onScroll, { passive: true });

/** Keep the centered title clear of the bar buttons (it truncates with … instead). */
function fitNavTitle() {
  const bar = navTitleEl.parentElement;
  const side = Math.max(leftBtn.hidden ? 0 : leftBtn.offsetWidth, rightBtn.hidden ? 0 : rightBtn.offsetWidth);
  navTitleEl.style.maxWidth = `${Math.max(60, bar.clientWidth - 2 * (side + 10))}px`;
}
window.addEventListener('resize', fitNavTitle);

let current = null;

function show(name) {
  if (!VIEWS[name]) name = 'learn';
  transport.stop();
  current?.unmount?.();
  viewEl.replaceChildren();
  nav.set();
  current = VIEWS[name];
  nav.title(current.title);
  current.mount(viewEl, nav);
  for (const t of document.querySelectorAll('.tab')) {
    const on = t.dataset.tab === name;
    t.classList.toggle('on', on);
    t.setAttribute('aria-selected', on);
  }
  store.set('tab', name);
  window.scrollTo(0, 0);
}

for (const t of document.querySelectorAll('.tab')) t.addEventListener('click', () => show(t.dataset.tab));

// Audio can only start after a user gesture.
const unlock = () => {
  unlockAudio();
  if (micWanted()) enableMic(); // the microphone was on last time: switch it back on
  window.removeEventListener('pointerdown', unlock, true);
  window.removeEventListener('keydown', unlock, true);
};
window.addEventListener('pointerdown', unlock, true);
window.addEventListener('keydown', unlock, true);

show(store.get('tab', 'learn'));
resumeMidi(); // reconnect an electronic drum kit that was set up before

/** A shared link carries a groove after "#g=". Open it in Build. */
function openShared() {
  if (!location.hash.startsWith('#g=')) return false;
  const g = decodeGroove(location.hash.slice(3));
  history.replaceState(null, '', location.pathname + location.search);
  if (!g) {
    toast('That groove link didn’t work');
    return false;
  }
  show('build');
  build.openGroove(g);
  return true;
}
if (!openShared()) maybeShowTour();
window.addEventListener('hashchange', openShared);

// Works offline once it has loaded (and can be added to the home screen).
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
