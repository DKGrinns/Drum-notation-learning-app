// Tap timing calibration: tap along with a click, and measure how late (or
// early) taps register. Phones and Bluetooth headphones add delay between a
// sound being scheduled and you hearing it; this one number corrects for that,
// plus any steady habit of tapping ahead of or behind the beat.
import { h, modal, toast } from './ui.js';
import { emptyPattern } from './grooves.js';
import { transport, audioTimeAt, playInstrument } from './audio.js';
import { tapOffset, setTapOffset, fmtOffset } from './tap.js';
import { midiOffset, setMidiOffset, onMidiHit } from './midi.js';

const BPM = 90;
const CLICKS = 16; // clicks to tap along with (after a 4-click count-in)
const SKIP = 2; // the first taps are often a bit off while you lock in
const MIN_TAPS = 8;

/**
 * Open the calibration sheet. onSaved(ms) runs when a new offset is saved.
 * source 'kit' measures hits on an electronic drum kit instead of taps.
 */
export function openCalibration(onSaved, source = 'tap') {
  const kit = source === 'kit';
  const getOffset = kit ? midiOffset : tapOffset;
  const setOffset = kit ? setMidiOffset : setTapOffset;
  let taps = [];
  let running = false;
  let result = null;

  const status = h('div', { class: 'cal-status' });
  const count = h('div', { class: 'cal-count' });
  const pad = h('button', { type: 'button', class: 'cal-pad', 'aria-label': 'Tap', disabled: kit }, kit ? 'Hit your snare' : 'Tap');
  const startBtn = h('button', { type: 'button', class: 'btn-primary' }, 'Start');
  const saveBtn = h('button', { type: 'button', class: 'btn-primary', hidden: true }, 'Use this timing');
  const current = h('p', { class: 'footnote cal-note' });

  const content = h('div', { class: 'cal' },
    h('p', { class: 'cal-intro' },
      kit ? 'The click reaches your ears a little late, more so over wireless headphones. Hit your snare along with '
        : 'Phones and wireless headphones play sound a little late. Tap the pad along with ',
      h('b', null, `${CLICKS} clicks`), ', and the app will learn the delay and correct your scores for it.'),
    h('div', { class: 'cal-stage' }, count, pad, status),
    h('div', { class: 'cal-actions' }, startBtn, saveBtn),
    current);

  const showCurrent = () => {
    current.textContent = `Current correction: ${fmtOffset(getOffset())}. Use the headphones or speaker you’ll practice with.`;
  };
  const setStatus = (text, n = '') => {
    status.textContent = text;
    count.textContent = n;
  };

  const onTap = (ts, silent) => {
    pad.classList.remove('hit');
    void pad.offsetWidth;
    pad.classList.add('hit');
    if (!silent) playInstrument('snare', undefined, 0.5);
    if (running) taps.push(audioTimeAt(ts));
  };
  // With a kit, any drum counts and the kit makes the sound.
  const offKit = kit ? onMidiHit((hit) => onTap(hit.ts, true)) : null;
  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    onTap(e.timeStamp);
  });
  const onKey = (e) => {
    if (kit || e.repeat || e.key !== ' ') return;
    e.preventDefault();
    onTap(e.timeStamp);
  };
  window.addEventListener('keydown', onKey);

  const finish = () => {
    running = false;
    const beat = 60 / BPM;
    const diffs = [];
    for (const t of taps) {
      const i = Math.round((t - transport.startTime) / beat);
      if (i < SKIP || i >= CLICKS) continue;
      const d = t - (transport.startTime + i * beat);
      if (Math.abs(d) < beat * 0.4) diffs.push(d * 1000);
    }
    startBtn.textContent = 'Try again';
    startBtn.classList.add('secondary');
    if (diffs.length < MIN_TAPS) {
      setStatus('Not enough taps matched the clicks. Try again and tap with every click.');
      return;
    }
    diffs.sort((a, b) => a - b);
    // Average the middle half: steady like a median, but less jumpy with few taps.
    const q = Math.floor(diffs.length / 4);
    const mid = diffs.slice(q, diffs.length - q);
    const median = mid.reduce((a, d) => a + d, 0) / mid.length;
    const spread = diffs.map((d) => Math.abs(d - median)).sort((a, b) => a - b)[diffs.length >> 1];
    if (spread > 45) {
      setStatus('Your taps were a bit uneven, so the result isn’t reliable. Try again, nice and steady.');
      return;
    }
    result = Math.round(median / 5) * 5;
    const ms = Math.abs(result);
    setStatus(ms < 10 ? 'Your taps line up with the click. No correction needed.'
      : `Your taps register about ${ms} ms ${result > 0 ? 'late' : 'early'}. The app will correct for that.`, fmtOffset(result));
    saveBtn.hidden = false;
  };

  startBtn.addEventListener('click', () => {
    if (running) {
      running = false;
      transport.stop();
      startBtn.textContent = 'Start';
      setStatus('Stopped. Press Start to try again.');
      return;
    }
    taps = [];
    result = null;
    saveBtn.hidden = true;
    running = true;
    startBtn.textContent = 'Stop';
    startBtn.classList.remove('secondary');
    setStatus('Listen…');
    transport.start({
      getBpm: () => BPM,
      getPattern: () => emptyPattern(),
      loops: CLICKS / 4,
      countInBeats: 4,
      playGroove: false,
      metronome: true,
      fullClick: true,
      onEvent: (ev) => {
        if (ev.type === 'count') setStatus('Listen…', String(ev.n));
        else if (ev.type === 'step' && ev.slot % 4 === 0) {
          const n = ev.loop * 4 + ev.slot / 4 + 1;
          setStatus('Tap with each click', `${n} of ${CLICKS}`);
        } else if (ev.type === 'end') setTimeout(finish, 200);
        else if (ev.type === 'interrupt') {
          running = false;
          startBtn.textContent = 'Start';
          setStatus('Stopped. Press Start to try again.');
        }
      },
    });
  });
  saveBtn.addEventListener('click', () => {
    if (result == null) return;
    setOffset(result);
    showCurrent();
    saveBtn.hidden = true;
    toast(`${kit ? 'Kit' : 'Tap'} timing set to ${fmtOffset(result)}`);
    onSaved?.(result);
    sheet.close();
  });

  showCurrent();
  setStatus(kit ? 'Press Start, listen to four clicks, then hit with the rest.' : 'Press Start, listen to four clicks, then tap with the rest.');
  const sheet = modal({
    title: kit ? 'Kit timing' : 'Tap timing',
    content,
    onClose: () => {
      running = false;
      transport.stop();
      window.removeEventListener('keydown', onKey);
      offKit?.();
    },
  });
  return sheet;
}
