// Microphone setup sheet: switch it on, check it hears your hits, and set its timing.
import { h, modal, row, stepper } from './ui.js';
import { fmtOffset } from './tap.js';
import { openCalibration } from './calibrate.js';
import {
  micSupported, micState, enableMic, disableMic, onMicHit, onMicLevel, onMicChange,
  micSensitivity, setMicSensitivity, micOffset, setMicOffset,
} from './mic.js';

/** One line saying whether the microphone is on, for a settings row. */
export function micSummary() {
  if (!micSupported()) return 'Not supported in this browser';
  return { on: 'On', denied: 'Permission needed', off: 'Off' }[micState()];
}

export function openMicSetup(onClose) {
  const body = h('div', { class: 'kit-setup' });
  const bar = h('i');
  const meter = h('div', { class: 'mic-meter', 'aria-hidden': 'true' }, bar);
  const heard = h('div', { class: 'kit-monitor' }, 'Hit your pad to test it.');
  let count = 0;

  const draw = () => {
    const st = micState();
    const offsetVal = h('span', { class: 'row-value' }, fmtOffset(micOffset()));
    const sensVal = h('span', { class: 'row-value' }, micSensitivity());
    const status = !micSupported()
      ? h('div', { class: 'kit-status off' }, h('b', null, 'This browser can’t use the microphone here.'), h('span', null, 'Try Chrome, Edge or Safari, opened from the app’s normal web address.'))
      : st === 'on'
        ? h('div', { class: 'kit-status on' }, h('b', null, 'The microphone is on.'), h('span', null, 'Hit your pad or drum and watch the bar below.'))
        : h('div', { class: 'kit-status off' },
          h('b', null, st === 'denied' ? 'The microphone is blocked or missing.' : 'The microphone is off.'),
          h('span', null, st === 'denied' ? 'Allow the microphone for this site in your browser’s settings, then try again.' : 'Turn it on to play along on a practice pad or an acoustic drum.'),
          h('button', { type: 'button', class: 'btn-primary', onClick: () => enableMic() }, 'Turn on the microphone'));
    body.replaceChildren(...[
      status,
      st === 'on' && meter,
      st === 'on' && heard,
      st === 'on' && h('div', { class: 'list' },
        row(['Sensitivity', h('span', { class: 'row-sub' }, 'Higher hears softer hits')], sensVal, stepper({
          value: micSensitivity(), min: 1, max: 10, label: 'sensitivity',
          onChange: (v) => {
            setMicSensitivity(v);
            sensVal.textContent = v;
          },
        })),
        h('button', { type: 'button', class: 'row row-btn', onClick: () => openCalibration(() => draw(), 'mic') },
          h('span', { class: 'row-main' }, h('span', null, 'Calibrate with the microphone'), h('span', { class: 'row-sub' }, 'Hit along to a click to measure delay'))),
        row('Mic timing', offsetVal, stepper({
          value: micOffset(), min: -300, max: 300, step: 5, label: 'microphone timing',
          onChange: (v) => {
            setMicOffset(v);
            offsetVal.textContent = fmtOffset(v);
          },
        }))),
      st === 'on' && h('button', { type: 'button', class: 'btn-plain', onClick: () => disableMic() }, 'Turn off the microphone'),
      h('p', { class: 'footnote' },
        'Wear headphones, or the microphone will hear the app’s own click and count it as a hit. A microphone can tell when you hit but not which drum, so each hit counts for whichever note is due. Nothing is recorded or sent anywhere.'),
    ].filter(Boolean));
  };

  const offs = [
    onMicChange(draw),
    onMicLevel((level) => {
      bar.style.width = `${Math.min(100, Math.round(Math.sqrt(level) * 100))}%`;
    }),
    onMicHit(() => {
      heard.textContent = `Heard ${++count} hit${count === 1 ? '' : 's'}.`;
      heard.classList.remove('hit');
      void heard.offsetWidth;
      heard.classList.add('hit');
    }),
  ];
  modal({
    title: 'Microphone', content: body, tall: true,
    onClose: () => {
      for (const off of offs) off();
      onClose?.();
    },
  });
  draw();
}
