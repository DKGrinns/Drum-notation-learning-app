import { transport, unlockAudio } from './audio.js';
import { store } from './store.js';
import * as build from './views/build.js';
import * as quiz from './views/quiz.js';
import * as listen from './views/listen.js';
import * as play from './views/play.js';

const VIEWS = { build, quiz, listen, play };

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
};

let current = null;

function show(name) {
  if (!VIEWS[name]) name = 'build';
  transport.stop();
  current?.unmount?.();
  viewEl.replaceChildren();
  nav.set();
  current = VIEWS[name];
  titleEl.textContent = current.title;
  document.title = `${current.title} · Drum Reader`;
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
  window.removeEventListener('pointerdown', unlock, true);
  window.removeEventListener('keydown', unlock, true);
};
window.addEventListener('pointerdown', unlock, true);
window.addEventListener('keydown', unlock, true);

show(store.get('tab', 'build'));
