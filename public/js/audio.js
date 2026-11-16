// Web Audio drum synth + sample-accurate transport.
// All drum sounds are synthesized, so there are no audio files to load.
import { beatsOf, isTrip, isLongBeat, beatStart, meterOf, NOTE } from './grooves.js';
import { store } from './store.js';

// Separate volumes (0–1) for the click and for the drum sounds.
const vol = { click: store.get('vol.click', 1), drums: store.get('vol.drums', 1) };
export const volume = (which) => vol[which];
export function setVolume(which, v) {
  vol[which] = Math.min(1, Math.max(0, v));
  store.set(`vol.${which}`, vol[which]);
}
const gainOf = (v) => v * v; // a slider feels even when loudness follows its square

let ctx = null;
let master = null;
let noiseBuffer = null;

export function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Audio details for a diagnostics report (null until sound has been used). */
export function audioInfo() {
  if (!ctx) return null;
  const o = ctx.getOutputTimestamp?.();
  return {
    state: ctx.state,
    sampleRate: ctx.sampleRate,
    baseLatencyMs: Math.round((ctx.baseLatency || 0) * 1000),
    outputLatencyMs: Math.round((ctx.outputLatency || 0) * 1000),
    hasOutputTimestamp: !!(o && o.performanceTime > 0),
  };
}

/** Browsers only allow audio after a user gesture; call this from the first tap. */
export function unlockAudio() {
  const c = getCtx();
  // A silent blip fully unlocks iOS Safari.
  const src = c.createBufferSource();
  src.buffer = c.createBuffer(1, 1, c.sampleRate);
  src.connect(c.destination);
  src.start();
}

/**
 * Convert a performance.now()-style timestamp (e.g. event.timeStamp) into
 * audio-context time *as heard at the speakers*. This accounts for output latency,
 * so taps can be compared directly against scheduled note times.
 */
export function audioTimeAt(perfTs = performance.now()) {
  const c = getCtx();
  if (c.getOutputTimestamp) {
    const o = c.getOutputTimestamp();
    if (o && o.performanceTime > 0) return o.contextTime + (perfTs - o.performanceTime) / 1000;
  }
  const lat = c.outputLatency || c.baseLatency || 0;
  return c.currentTime - lat + (perfTs - performance.now()) / 1000;
}

function noise() {
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  return src;
}

function env(t, peak, decay) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  return g;
}

function filter(type, freq, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

function metal(t, out, { decay, peak, hp }) {
  const g = env(t, peak, decay);
  g.endAt = t + decay;
  const bp = filter('bandpass', 10000, 0.8);
  const hpf = filter('highpass', hp);
  bp.connect(hpf).connect(g).connect(out);
  for (const r of [2, 3, 4.16, 5.43, 6.79, 8.21]) {
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = 40 * r;
    o.connect(bp);
    o.start(t);
    o.stop(t + decay + 0.05);
  }
  return g;
}

// An open hi-hat rings until the next closed hi-hat cuts it off (the "choke").
let openHat = null;
function choke(t) {
  if (!openHat || openHat.start >= t || openHat.g.endAt <= t) return;
  const gain = openHat.g.gain;
  gain.cancelScheduledValues(t);
  gain.setTargetAtTime(0.0001, t, 0.012);
  openHat = null;
}

function tom(t, out, v, f) {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * 0.62, t + 0.3);
  const g = env(t, 0.9 * v, 0.5);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.55);
}

const VOICES = {
  kick(t, out, v) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    const g = env(t, 1.1 * v, 0.45);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.5);
  },
  snare(t, out, v) {
    const n = noise();
    const g = env(t, 0.75 * v, 0.2);
    n.connect(filter('highpass', 1300)).connect(g).connect(out);
    n.start(t);
    n.stop(t + 0.25);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
    const og = env(t, 0.55 * v, 0.1);
    o.connect(og).connect(out);
    o.start(t);
    o.stop(t + 0.12);
  },
  hihat(t, out, v) {
    choke(t);
    metal(t, out, { decay: 0.06, peak: 0.35 * v, hp: 7000 });
  },
  // The pedal closing the hi-hat: a short, soft "chick" that also cuts off an open hi-hat.
  hhfoot(t, out, v) {
    choke(t);
    metal(t, out, { decay: 0.045, peak: 0.24 * v, hp: 8000 });
  },
  // Cross-stick: the stick laid across the snare, tapping the rim. A dry, woody click.
  rim(t, out, v) {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(1700, t);
    o.frequency.exponentialRampToValueAtTime(950, t + 0.03);
    const g = env(t, 0.55 * v, 0.06);
    o.connect(filter('bandpass', 1500, 2)).connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.08);
    const n = noise();
    const ng = env(t, 0.22 * v, 0.03);
    n.connect(filter('highpass', 2500)).connect(ng).connect(out);
    n.start(t);
    n.stop(t + 0.05);
  },
  // The bell of the ride: a clear ping with less wash.
  rideBell(t, out, v) {
    metal(t, out, { decay: 0.6, peak: 0.08 * v, hp: 6500 });
    for (const f of [1950, 2900]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = env(t, 0.11 * v, 0.7);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.75);
    }
  },
  hihatOpen(t, out, v) {
    choke(t);
    const g = metal(t, out, { decay: 0.45, peak: 0.3 * v, hp: 6000 });
    openHat = { g, start: t };
  },
  ride(t, out, v) {
    metal(t, out, { decay: 0.9, peak: 0.16 * v, hp: 5200 });
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 2500;
    const g = env(t, 0.05 * v, 0.5);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.55);
  },
  crash(t, out, v) {
    metal(t, out, { decay: 1.6, peak: 0.22 * v, hp: 4000 });
    const n = noise();
    const g = env(t, 0.28 * v, 1.4);
    n.connect(filter('highpass', 3500)).connect(g).connect(out);
    n.start(t);
    n.stop(t + 1.5);
  },
  tom1: (t, out, v) => tom(t, out, v, 260),
  tom2: (t, out, v) => tom(t, out, v, 190),
  floor: (t, out, v) => tom(t, out, v, 120),
};

/** Play one drum now (or at audio time `t`). */
export function playInstrument(id, t, velocity = 1, out) {
  const c = getCtx();
  const v = velocity * gainOf(vol.drums);
  if (v > 0) VOICES[id]?.(t ?? c.currentTime, out || master, v);
}

/** How loud each kind of note is. */
const LEVEL = { [NOTE.HIT]: 0.9, [NOTE.ACCENT]: 1.35, [NOTE.GHOST]: 0.28, [NOTE.OPEN]: 0.9, [NOTE.FLAM]: 0.95 };

/** Play a written note: an accent is louder, a ghost note soft, a flam two quick strokes. */
export function playNote(id, value = NOTE.HIT, t, out) {
  const c = getCtx();
  t = t ?? c.currentTime + 0.005;
  if (value === NOTE.OPEN && id === 'hihat') return playInstrument('hihatOpen', t, LEVEL[value], out);
  if (value === NOTE.TIE) return; // held over from the note before: nothing is struck
  if (value === NOTE.CROSS && id === 'snare') return playInstrument('rim', t, 0.9, out);
  if (value === NOTE.RIM && id === 'snare') {
    playInstrument('rim', t, 0.7, out);
    return playInstrument('snare', t, 1.3, out);
  }
  if (value === NOTE.ROLL) {
    // A buzz: quick, even, soft strokes.
    for (let i = 0; i < 6; i++) playInstrument(id, t + i * 0.03, i ? 0.34 : 0.5, out);
    return;
  }
  if (value === NOTE.DRAG) for (const back of [0.062, 0.032]) playInstrument(id, Math.max(c.currentTime, t - back), 0.32, out);
  if (value === NOTE.BELL && id === 'ride') return playInstrument('rideBell', t, 1, out);
  if (value === NOTE.FLAM) playInstrument(id, Math.max(c.currentTime, t - 0.032), 0.4, out);
  playInstrument(id, t, LEVEL[value] ?? 0.9, out);
}

function click(t, accent, out, full) {
  const peak = (accent ? 0.5 : 0.32) * (full ? 1 : gainOf(vol.click));
  if (peak <= 0) return;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = accent ? 1760 : 1180;
  const g = env(t, peak, 0.05);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.06);
}

const val = (v) => (typeof v === 'function' ? v() : v);

const TICKS = 24; // scheduler ticks per beat: 16ths land every 6, triplet 8ths every 8, 32nds every 3

// Keep the phone's screen on while something is playing.
let wake = null;
let wakeWanted = false;
function holdScreen(on) {
  wakeWanted = on;
  if (!on) {
    wake?.release().catch(() => {});
    wake = null;
    return;
  }
  if (wake || !navigator.wakeLock) return;
  navigator.wakeLock.request('screen').then((w) => {
    if (wakeWanted && !wake) wake = w;
    else w.release().catch(() => {});
  }).catch(() => {});
}

/**
 * Loops a one-bar pattern with a look-ahead scheduler. getPattern is called with
 * the number of the bar being played (0, 1, 2…), so it can also return a
 * different bar each time round to play a chart of several bars.
 * Emits UI events in sync with what the listener *hears*:
 *   { type: 'count', n }        count-in beat (1..4)
 *   { type: 'step', slot, loop } a slot of the pattern (16th, or triplet 8th in a triplet beat)
 *   { type: 'end' }             finished (finite loops only)
 *   { type: 'interrupt' }       stopped because the app went to the background
 * `startTime` is beat 1 of the first loop and `sixteenth` the length of a 16th (seconds).
 */
class Transport {
  constructor() {
    this.running = false;
  }

  start({ getBpm, getPattern, loops = Infinity, countInBeats = 0, playGroove = true, metronome = false, fullClick = false, onEvent }) {
    this.stop();
    const c = getCtx();
    // fullClick ignores the click volume (calibration needs the click to be heard).
    this.opts = { getBpm, getPattern, loops, playGroove, metronome, onEvent, countInBeats, fullClick };
    const first = getPattern(0);
    this.beats = beatsOf(first); // beats per bar (the meter stays put while playing)
    // Where each beat starts, in ticks. Beats are usually equal; the last beat of 7/8 is half as long again.
    this.starts = Array.from({ length: this.beats + 1 }, (_, b) => (beatStart(first, b) * TICKS) / 4);
    this.barTicks = this.starts[this.beats];
    // An uneven bar is counted in as one whole bar, so you hear its shape.
    this.countTicks = countInBeats && meterOf(first).odd ? this.barTicks : countInBeats * TICKS;
    this.bus = c.createGain();
    this.bus.connect(master);
    this.step = -this.countTicks;
    this.nextTime = c.currentTime + 0.12;
    this.sixteenth = 60 / getBpm() / 4;
    // Time of beat 1 of the first loop (valid while tempo is constant).
    this.startTime = this.nextTime + (this.countTicks / TICKS) * 4 * this.sixteenth;
    this.queue = [];
    this.done = false;
    this.running = true;
    holdScreen(true);
    // The timer schedules audio and also drains UI events, so events still arrive
    // when animation frames are paused (e.g. a hidden or dimmed screen).
    this.timer = setInterval(() => this._tick(), 25);
    this._tick();
    const frame = () => {
      if (!this.running) return;
      this._drain();
      if (this.running) this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  _drain() {
    const now = audioTimeAt();
    while (this.running && this.queue.length && this.queue[0].time <= now) {
      const ev = this.queue.shift();
      if (ev.type === 'end') this.stop();
      this.opts.onEvent?.(ev);
    }
  }

  _tick() {
    const c = getCtx();
    const { getBpm, loops } = this.opts;
    while (this.running && !this.done && this.nextTime < c.currentTime + 0.12) {
      if (this.step >= loops * this.barTicks) {
        this.queue.push({ type: 'end', time: this.nextTime });
        this.done = true;
        break;
      }
      this._schedule(this.step, this.nextTime);
      this.nextTime += 60 / getBpm() / TICKS;
      this.step++;
    }
    this._drain();
  }

  _schedule(step, t) {
    const { getPattern, playGroove, metronome, countInBeats, fullClick } = this.opts;
    const uneven = this.barTicks !== this.beats * TICKS;
    if (step < 0) {
      const pos = step + this.countTicks;
      // The beat that starts here, if one does.
      const b = uneven ? this.starts.lastIndexOf(pos, this.beats - 1) : pos % TICKS === 0 ? pos / TICKS : -1;
      if (b >= 0) {
        click(t, b % this.beats === 0, this.bus, fullClick);
        this.queue.push({ type: 'count', n: b + 1, time: t });
      }
      return;
    }
    const tick = step % this.barTicks;
    const loop = Math.floor(step / this.barTicks);
    let beat = this.beats - 1;
    while (this.starts[beat] > tick) beat--;
    const within = tick - this.starts[beat];
    if (val(metronome) && within === 0) click(t, beat === 0, this.bus, fullClick);
    const p = getPattern(loop);
    const per = isLongBeat(p, beat) ? 12 : isTrip(p, beat) ? 8 : 6; // ticks per slot in this beat
    if (within % per) {
      // Halfway between two slots: the extra notes of a beat split in 32nds or sextuplets.
      if (within % per === per / 2 && p.fine?.[beat] && val(playGroove)) {
        const at = beat * 4 + Math.floor(within / per);
        for (const id in p.x || {}) if (p.x[id][at]) playNote(id, p.x[id][at], t, this.bus);
      }
      return;
    }
    const slot = beat * 4 + within / per;
    if (val(playGroove)) {
      for (const id in p) if (VOICES[id] && Array.isArray(p[id]) && p[id][slot]) playNote(id, p[id][slot], t, this.bus);
    }
    this.queue.push({ type: 'step', slot, loop, time: t });
  }

  stop() {
    if (!this.running && !this.timer) return;
    this.running = false;
    holdScreen(false);
    clearInterval(this.timer);
    this.timer = null;
    cancelAnimationFrame(this.raf);
    // Silence anything already scheduled.
    if (this.bus && ctx) {
      this.bus.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
      const b = this.bus;
      setTimeout(() => b.disconnect(), 300);
    }
  }

  /** Stop because the app is no longer in front, and tell whoever started it. */
  interrupt() {
    if (!this.running) return;
    const onEvent = this.opts?.onEvent;
    this.stop();
    onEvent?.({ type: 'interrupt' });
  }
}

export const transport = new Transport();

// A phone pauses audio and timers in the background, which would wreck the timing
// of a run, so stop cleanly instead.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) transport.interrupt();
  });
}
