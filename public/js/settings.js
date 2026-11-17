// Settings: everything that applies to the whole app, in one sheet.
// Opened from the gear in the navigation bar (on every tab) and from Play.
import { h, modal, row, slider, stepper, svgIcon, ICONS } from './ui.js';
import { volume, setVolume, playInstrument } from './audio.js';
import { tapOffset, setTapOffset, fmtOffset } from './tap.js';
import { openKitSetup, kitSummary } from './kitsetup.js';
import { openMicSetup, micSummary } from './micsetup.js';
import { openCalibration } from './calibrate.js';
import { openThemePicker, currentTheme } from './theme.js';
import { openTour } from './tour.js';
import { downloadBackup, restoreBackup, lastBackup } from './backup.js';

/** A row that opens something: a title, a line of explanation and (optionally) the current value. */
function link(title, sub, onClick, value) {
  return h('button', { type: 'button', class: 'row row-btn', onClick },
    h('span', { class: 'row-main' }, h('span', null, title), typeof sub === 'string' ? h('span', { class: 'row-sub' }, sub) : sub),
    value, svgIcon(ICONS.chevron, 'icon chevron'));
}

const section = (label, ...rows) => [h('div', { class: 'section-label' }, label), h('div', { class: 'list' }, rows)];

export function openSettings() {
  const kitVal = h('span', { class: 'row-value' }, kitSummary());
  const micVal = h('span', { class: 'row-value' }, micSummary());
  const themeVal = h('span', { class: 'row-value' }, currentTheme().name);
  const offsetVal = h('span', { class: 'row-value' }, fmtOffset(tapOffset()));
  const backupSub = h('span', { class: 'row-sub' }, lastBackup());
  const offsetStepper = stepper({
    value: tapOffset(), min: -300, max: 300, step: 5, label: 'tap offset',
    onChange: (v) => {
      setTapOffset(v);
      offsetVal.textContent = fmtOffset(v);
    },
  });
  const showOffset = (v) => {
    offsetVal.textContent = fmtOffset(v);
    offsetStepper.set(v);
  };

  const content = h('div', { class: 'settings' },
    section('Sound',
      row('Click volume', slider(Math.round(volume('click') * 100), (v) => setVolume('click', v / 100), 'Click volume')),
      row('Drum volume', slider(Math.round(volume('drums') * 100), (v) => {
        setVolume('drums', v / 100);
        playInstrument('snare'); // so you hear the new level
      }, 'Drum volume'))),
    section('Play with',
      link('Electronic drum kit', 'Play along on a real kit over USB', () => openKitSetup(() => { kitVal.textContent = kitSummary(); }), kitVal),
      link('Microphone', 'Play along on a practice pad or acoustic drum', () => openMicSetup(() => { micVal.textContent = micSummary(); }), micVal)),
    section('Timing',
      link('Calibrate tap timing', 'Tap along to a click to measure delay', () => openCalibration(showOffset)),
      row(['Tap offset', h('span', { class: 'row-sub' }, 'For the on-screen pads and keyboard')], offsetVal, offsetStepper)),
    section('Appearance',
      link('Look', 'Colours and style of the whole app', () => openThemePicker(() => { themeVal.textContent = currentTheme().name; }), themeVal)),
    section('Help',
      link('Show the quick tour', 'What each tab is for', () => openTour())),
    section('Backup',
      link('Save a backup file', backupSub, () => {
        downloadBackup();
        backupSub.textContent = lastBackup();
      }),
      link('Restore from a backup', 'Replaces the progress on this device', () => restoreBackup(() => location.reload()))),
    h('p', { class: 'footnote' }, 'Your progress is stored only in this browser. A backup file lets you keep it safe or move it to another device.'),
  );
  modal({ title: 'Settings', content, tall: true });
}
