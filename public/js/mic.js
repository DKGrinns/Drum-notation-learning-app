// Microphone input: hear hits on a practice pad or an acoustic drum.
// A microphone knows *when* something was hit but not *which* drum, so a hit
// counts for whichever note is due (see tapSession.hitAny).
import { getCtx } from './audio.js';
import { store } from './store.js';

const S = { state: 'off', stream: null, source: null, node: null, hitFns: new Set(), levelFns: new Set(), changeFns: new Set() };

export const micSupported = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof AudioWorkletNode !== 'undefined';
/** 'off', 'on', or 'denied' (no permission, or no microphone). */
export const micState = () => S.state;
/** Whether the microphone was left on last time. */
export const micWanted = () => !!store.get('mic.on', false);

/** Timing correction for microphone hits, in ms (positive: hits register late). */
export const micOffset = () => store.get('mic.offset', 0);
export const setMicOffset = (ms) => store.set('mic.offset', ms);

/** Sensitivity 1 (only hard hits) to 10 (soft taps too). */
export const micSensitivity = () => store.get('mic.sens', 5);
/** The loudness a hit must reach at a given sensitivity. */
export const thresholdFor = (sens) => 0.5 * 0.7 ** (sens - 1);
export function setMicSensitivity(v) {
  store.set('mic.sens', v);
  S.node?.port.postMessage({ threshold: thresholdFor(v) });
}

const changed = () => {
  for (const fn of S.changeFns) fn();
};

/** Turn the microphone on (asks for permission the first time). Resolves to the new state. */
export async function enableMic() {
  if (!micSupported()) return S.state;
  if (S.state === 'on') return S.state;
  try {
    const ctx = getCtx();
    // The browser's voice clean-up would smear or swallow drum hits, so switch it off.
    S.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    await ctx.audioWorklet.addModule(new URL('./mic-worklet.js', import.meta.url));
    S.source = ctx.createMediaStreamSource(S.stream);
    S.node = new AudioWorkletNode(ctx, 'onset-detector', { numberOfOutputs: 0 });
    S.node.port.postMessage({ threshold: thresholdFor(micSensitivity()) });
    S.node.port.onmessage = (e) => {
      if (e.data.level != null) for (const fn of S.levelFns) fn(e.data.level);
      if (e.data.hit == null) return;
      // Turn the audio clock's time into the page clock's, which the scoring uses for every input.
      const ts = performance.now() - (ctx.currentTime - e.data.hit) * 1000;
      for (const fn of S.hitFns) fn({ ts, peak: e.data.peak, source: 'mic' });
    };
    S.source.connect(S.node);
    S.state = 'on';
    store.set('mic.on', true);
  } catch {
    stop();
    S.state = 'denied';
  }
  changed();
  return S.state;
}

function stop() {
  S.source?.disconnect();
  S.node?.port.close();
  for (const t of S.stream?.getTracks() || []) t.stop();
  S.stream = S.source = S.node = null;
}

export function disableMic() {
  stop();
  S.state = 'off';
  store.set('mic.on', false);
  changed();
}

const listen = (set) => (fn) => {
  set.add(fn);
  return () => set.delete(fn);
};
/** Each hit the microphone hears: fn({ ts, peak, source }). Returns a function that stops listening. */
export const onMicHit = listen(S.hitFns);
/** The loudness right now (0–1), a few times a second, for a level meter. */
export const onMicLevel = listen(S.levelFns);
export const onMicChange = listen(S.changeFns);
