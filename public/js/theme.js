// Appearance: the app's look. The colours and shapes live in css/themes.css;
// this picks one and remembers it. (index.html applies the saved one before the
// page first paints, so there is no flash of the wrong look.)
import { sheet } from './ui.js';
import { store } from './store.js';

export const THEMES = [
  { id: 'auto', name: 'Classic', detail: 'Light or dark, following your device' },
  { id: 'studio', name: 'Studio Gray', detail: 'Flat mid-grey with orange and cyan, like Ableton Live', bar: '#8f8f8f' },
  { id: 'studio-dark', name: 'Studio Dark', detail: 'The same look on dark grey', bar: '#4f4f4f' },
  { id: 'groove', name: 'Groovebox', detail: 'Near-black with glowing pads, like Maschine', bar: '#131313' },
];

const find = (id) => THEMES.find((t) => t.id === id) || THEMES[0];
export const currentTheme = () => find(store.get('theme', 'auto'));

/** Switch the look now and remember it. */
export function setTheme(id) {
  const t = find(id);
  store.set('theme', t.id);
  if (t.id === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t.id;
  // The colour of the phone's status bar area.
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) {
    m.dataset.auto = m.dataset.auto || m.content;
    m.content = t.bar || m.dataset.auto;
  }
}

export function openThemePicker(onChange) {
  sheet({
    title: 'Appearance',
    items: THEMES.map((t) => ({
      label: t.name,
      detail: t.detail,
      checked: t.id === currentTheme().id,
      onClick: () => {
        setTheme(t.id);
        onChange?.();
      },
    })),
  });
}
