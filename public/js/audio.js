// Web Audio drum synth + sample-accurate transport.
// All drum sounds are synthesized, so there are no audio files to load.

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
  hihat: (t, out, v) => metal(t, out, { decay: 0.06, peak: 0.35 * v, hp: 7000 }),
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
  VOICES[id]?.(t ?? c.currentTime, out || master, velocity);
}

function click(t, accent, out) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = accent ? 1760 : 1180;
  const g = env(t, accent ? 0.5 : 0.32, 0.05);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.06);
}

const val = (v) => (typeof v === 'function' ? v() : v);

/**
 * Loops a one-bar pattern with a look-ahead scheduler.
 * Emits UI events in sync with what the listener *hears*:
 *   { type: 'count', n }        count-in beat (1..4)
 *   { type: 'step', slot, loop } a 16th-note step
 *   { type: 'end' }             finished (finite loops only)
 */
class Transport {
  constructor() {
    this.running = false;
  }

  start({ getBpm, getPattern, loops = Infinity, countInBeats = 0, playGroove = true, metronome = false, onEvent }) {
    this.stop();
    const c = getCtx();
    this.opts = { getBpm, getPattern, loops, playGroove, metronome, onEvent, countInBeats };
    this.bus = c.createGain();
    this.bus.connect(master);
    this.step = -countInBeats * 4;
    this.nextTime = c.currentTime + 0.12;
    this.sixteenth = 60 / getBpm() / 4;
    // Time of beat 1 of the first loop (valid while tempo is constant).
    this.startTime = this.nextTime + countInBeats * 4 * this.sixteenth;
    this.queue = [];
    this.done = false;
    this.running = true;
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
      if (this.step >= loops * 16) {
        this.queue.push({ type: 'end', time: this.nextTime });
        this.done = true;
        break;
      }
      this._schedule(this.step, this.nextTime);
      this.nextTime += 60 / getBpm() / 4;
      this.step++;
    }
    this._drain();
  }

  _schedule(step, t) {
    const { getPattern, playGroove, metronome, countInBeats } = this.opts;
    if (step < 0) {
      const pos = step + countInBeats * 4;
      if (pos % 4 === 0) {
        const n = pos / 4 + 1;
        click(t, n === 1, this.bus);
        this.queue.push({ type: 'count', n, time: t });
      }
      return;
    }
    const slot = step % 16;
    const loop = Math.floor(step / 16);
    if (val(metronome) && slot % 4 === 0) click(t, slot === 0, this.bus);
    if (val(playGroove)) {
      const p = getPattern();
      for (const id in p) if (p[id][slot]) playInstrument(id, t, 0.9, this.bus);
    }
    this.queue.push({ type: 'step', slot, loop, time: t });
  }

  stop() {
    if (!this.running && !this.timer) return;
    this.running = false;
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
}

export const transport = new Transport();
