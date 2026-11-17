// Kit setup sheet: connect an electronic drum kit, check each pad, and teach the
// app any pad it gets wrong ("hit to learn").
import { h, modal, row, stepper, toggle, toast } from './ui.js';
import { KIT, byId } from './kit.js';
import { fmtOffset } from './tap.js';
import { openCalibration } from './calibrate.js';
import { audioInfo, outputDelayMs, delayAdvice } from './audio.js';
import { diagOn, setDiagOn, diagCounts, clearDiag, downloadDiag } from './diag.js';
import {
  midiSupported, midiState, midiInputs, enableMidi, disableMidi, midiMap, notesFor, assignNotes, resetMap, isDefaultMap,
  noteName, IGNORE, midiOffset, setMidiOffset, midiSounds, setMidiSounds, midiFloor, setMidiFloor, tooSoft, onMidiNote, onMidiChange,
} from './midi.js';

/** One line saying whether a kit is connected, for a settings row. */
export function kitSummary() {
  if (!midiSupported()) return 'Not supported in this browser';
  const st = midiState();
  if (st === 'on') return midiInputs()[0] || 'On · no kit found';
  return st === 'denied' ? 'Permission needed' : 'Off';
}

export function openKitSetup(onClose) {
  let learning = null; // { id, notes: Set } while teaching one drum
  const body = h('div', { class: 'kit-setup' });
  const monitor = h('div', { class: 'kit-monitor' }, 'Hit any pad to test it.');

  const label = (n) => (noteName(n).startsWith('Note ') ? noteName(n) : `${noteName(n)} (${n})`);
  const zones = (id) => {
    const notes = notesFor(id);
    return notes.length ? notes.map(label).join(', ') : 'Not set. Press Learn and hit it.';
  };

  const statusCard = () => {
    const st = midiState();
    const kits = midiInputs();
    if (!midiSupported()) {
      return h('div', { class: 'kit-status off' },
        h('b', null, 'This browser can’t talk to drum kits.'),
        h('span', null, 'Use Chrome or Edge on Android, Windows, Mac or a Chromebook. iPhone and iPad browsers don’t support it.'));
    }
    if (st !== 'on') {
      return h('div', { class: 'kit-status off' },
        h('b', null, st === 'denied' ? 'The browser blocked access to MIDI devices.' : 'No kit connected yet.'),
        h('span', null, st === 'denied'
          ? 'Allow “MIDI devices” for this site in the browser’s site settings, then try again.'
          : 'Plug your kit into this device with a USB cable, then press Connect. The browser will ask for permission once.'),
        h('button', { type: 'button', class: 'btn-primary', disabled: st === 'starting', onClick: () => enableMidi() }, st === 'starting' ? 'Connecting…' : 'Connect'));
    }
    return h('div', { class: `kit-status ${kits.length ? 'on' : 'off'}` },
      h('b', null, kits.length ? `Connected: ${kits.join(', ')}` : 'Listening, but no kit found.'),
      h('span', null, kits.length
        ? 'Hit each pad and watch the line below. If a pad shows the wrong drum, use Learn.'
        : 'Check the USB cable goes to the kit’s USB COMPUTER port and the module is switched on.'),
      monitor);
  };

  const drumRow = (k) => {
    const on = learning?.id === k.id;
    const sub = on
      ? (learning.notes.size ? [...learning.notes].map(label).join(', ') : 'Hit every part of it now: head, rim, bow, edge, bell…')
      : zones(k.id);
    return h('div', { class: `row kit-row${on ? ' learning' : ''}` },
      h('span', { class: 'row-main' }, h('span', null, k.name), h('span', { class: 'row-sub' }, sub)),
      h('button', {
        type: 'button', class: `chip-btn${on ? ' on' : ''}`, disabled: midiState() !== 'on',
        onClick: () => {
          if (on) {
            if (learning.notes.size) {
              assignNotes(k.id, [...learning.notes]);
              toast(`${k.name} updated`);
            }
            learning = null;
          } else learning = { id: k.id, notes: new Set() };
          draw();
        },
      }, on ? 'Done' : 'Learn'));
  };

  const draw = () => {
    const offsetVal = h('span', { class: 'row-value' }, fmtOffset(midiOffset()));
    const floorVal = h('span', { class: 'row-value' }, midiFloor());
    body.replaceChildren(...[
      statusCard(),
      h('div', { class: 'section-label' }, 'Your drums'),
      h('div', { class: 'list' }, KIT.map(drumRow)),
      h('p', { class: 'footnote' }, 'The standard layout and Roland’s (including the TD-17 and VH-10 hi-hat) are built in.'),
      !isDefaultMap() && h('button', { type: 'button', class: 'btn-plain', onClick: () => { learning = null; resetMap(); toast('Back to the built-in layout'); } }, 'Reset to the built-in layout'),
      h('div', { class: 'section-label' }, 'Timing and sound'),
      h('div', { class: 'list' },
        h('button', { type: 'button', class: 'row row-btn', disabled: midiState() !== 'on', onClick: () => openCalibration(() => draw(), 'kit') },
          h('span', { class: 'row-main' }, h('span', null, 'Calibrate with the kit'), h('span', { class: 'row-sub' }, 'Hit the snare along to a click'))),
        row('Kit timing', offsetVal, stepper({
          value: midiOffset(), min: -300, max: 300, step: 5, label: 'kit timing',
          onChange: (v) => {
            setMidiOffset(v);
            offsetVal.textContent = fmtOffset(v);
          },
        })),
        row(['Softest hit that counts', h('span', { class: 'row-sub' }, 'Weaker hits are ignored. Twice this for the kick.')], floorVal, stepper({
          value: midiFloor(), min: 1, max: 40, label: 'softest hit that counts',
          onChange: (v) => {
            setMidiFloor(v);
            floorVal.textContent = v;
          },
        })),
        row(['App drum sounds', h('span', { class: 'row-sub' }, 'Off if you listen through the kit’s module')], toggle(midiSounds(), (v) => {
          setMidiSounds(v);
          draw();
        }, 'App drum sounds for kit hits'))),
      midiSounds() && delayAdvice(outputDelayMs()) && h('p', { class: 'footnote' }, delayAdvice(outputDelayMs())),
      midiState() === 'on' && h('button', { type: 'button', class: 'btn-plain', onClick: () => disableMidi() }, 'Disconnect'),
      h('div', { class: 'section-label' }, 'Diagnostics'),
      h('div', { class: 'list' },
        row(['Record diagnostics', h('span', { class: 'row-sub' }, 'What the kit sends and how runs are scored')], toggle(diagOn(), (v) => {
          setDiagOn(v);
          draw();
        }, 'Record diagnostics')),
        h('button', {
          type: 'button', class: 'row row-btn', disabled: !diagCounts().events && !diagCounts().runs,
          onClick: () => {
            downloadDiag({ audio: audioInfo(), kit: { state: midiState(), inputs: midiInputs() } });
            toast('Diagnostics file saved to your downloads');
          },
        }, h('span', { class: 'row-main' }, h('span', null, 'Save diagnostics file'),
          h('span', { class: 'row-sub' }, `${diagCounts().runs} run${diagCounts().runs === 1 ? '' : 's'} and ${diagCounts().events} events recorded`)))),
      (diagCounts().events || diagCounts().runs) ? h('button', { type: 'button', class: 'btn-plain', onClick: () => { clearDiag(); draw(); } }, 'Clear the recording') : null,
      h('p', { class: 'footnote' }, 'For troubleshooting. It records data only, never sound, keeps just the most recent runs, and stays on this device unless you save the file and send it.'),
    ].filter(Boolean));
  };

  const offNote = onMidiNote(({ note, velocity }) => {
    if (learning) {
      learning.notes.add(note);
      draw();
      return;
    }
    const id = midiMap()[note];
    const to = !id ? 'not set to any drum' : id === IGNORE ? 'heard, not scored' : tooSoft(id, velocity) ? `${byId[id]?.name}, too soft to count` : byId[id]?.name;
    monitor.textContent = `${noteName(note)} · note ${note} · strength ${velocity} → ${to}`;
    monitor.classList.remove('hit');
    void monitor.offsetWidth;
    monitor.classList.add('hit');
  });
  const offChange = onMidiChange(draw);

  draw();
  return modal({
    title: 'Electronic drum kit',
    content: body,
    tall: true,
    onClose: () => {
      offNote();
      offChange();
      onClose?.();
    },
  });
}
