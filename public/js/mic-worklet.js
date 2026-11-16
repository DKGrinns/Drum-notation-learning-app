// Runs on the audio thread: listens to the microphone and reports the moment of each hit.
// A hit is a sudden jump in loudness, well above both a set level and the room's background.

/** Seconds to ignore after a hit, so one stroke (and its ring) is reported once. */
const HOLD = 0.07;

class OnsetDetector extends AudioWorkletProcessor {
  constructor() {
    super();
    this.threshold = 0.12; // loudness (0–1) a hit must reach
    this.floor = 0; // the recent background level
    this.hold = 0; // samples left to ignore
    this.blocks = 0;
    this.port.onmessage = (e) => {
      if (typeof e.data?.threshold === 'number') this.threshold = e.data.threshold;
    };
  }

  process(inputs) {
    const ch = inputs[0]?.[0];
    if (!ch) return true;
    let peak = 0;
    let first = -1; // the first sample loud enough to be a hit
    const bar = Math.max(this.threshold, this.floor * 4);
    for (let i = 0; i < ch.length; i++) {
      const a = Math.abs(ch[i]);
      if (a > peak) peak = a;
      if (first < 0 && a >= bar) first = i;
    }
    if (this.hold > 0) this.hold -= ch.length;
    else if (first >= 0) {
      // currentTime is the time of this block's first sample.
      this.port.postMessage({ hit: currentTime + first / sampleRate, peak });
      this.hold = HOLD * sampleRate;
    }
    // Follow the background slowly, so a hit doesn't raise the bar for the next one much.
    this.floor += (Math.min(peak, this.threshold) - this.floor) * 0.02;
    if (++this.blocks % 12 === 0) this.port.postMessage({ level: peak });
    return true;
  }
}

registerProcessor('onset-detector', OnsetDetector);
