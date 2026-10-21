/**
 * Audio.
 *
 * Everything is synthesised at runtime with the Web Audio API, so the site
 * ships without a single audio file. Browsers block autoplay, so the music
 * starts muted and waits for a deliberate click on the toggle.
 */

const STORAGE_KEY = 'birthday.music';

const NOTE = {
  G4: 392.0,
  A4: 440.0,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
  C6: 1046.5,
};

/** "Happy Birthday to You" -- note name plus its length in beats. */
const MELODY = [
  [
    [NOTE.G4, 0.75], [NOTE.G4, 0.25], [NOTE.A4, 1],
    [NOTE.G4, 1], [NOTE.C5, 1], [NOTE.B4, 2],
  ],
  [
    [NOTE.G4, 0.75], [NOTE.G4, 0.25], [NOTE.A4, 1],
    [NOTE.G4, 1], [NOTE.D5, 1], [NOTE.C5, 2],
  ],
  [
    [NOTE.G4, 0.75], [NOTE.G4, 0.25], [NOTE.G5, 1],
    [NOTE.E5, 1], [NOTE.C5, 1], [NOTE.B4, 1], [NOTE.A4, 1],
  ],
  [
    [NOTE.F5, 0.5], [NOTE.F5, 0.5], [NOTE.E5, 1],
    [NOTE.C5, 1], [NOTE.D5, 1], [NOTE.C5, 2],
  ],
];

export class AudioEngine {
  constructor(options = {}) {
    this.context = null;
    this.master = null;
    this.enabled = false;
    this.started = false;
    this._noise = null;
    this._preference = options.enabled ?? true;
    this._restore();
  }

  _restore() {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        this._preference = stored === 'true';
      }
    } catch {
      /* storage unavailable, keep the default */
    }
  }

  _persist() {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(this._preference));
    } catch {
      /* ignore */
    }
  }

  /** The stored preference, which may differ from what is playing right now. */
  get preference() {
    return this._preference;
  }

  /** Create the audio graph. Must be called from a user gesture. */
  _create() {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) {
      return false;
    }

    this.context = new Ctor();
    this.master = this.context.createGain();
    this.master.gain.value = 0.9;

    // A short feedback delay gives the melody some room.
    const delay = this.context.createDelay(1);
    delay.delayTime.value = 0.19;
    const feedback = this.context.createGain();
    feedback.gain.value = 0.26;
    const wet = this.context.createGain();
    wet.gain.value = 0.3;

    this.master.connect(this.context.destination);
    this.master.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(this.context.destination);

    return true;
  }

  /** Turn the music on (and play the melody). */
  async enable() {
    if (!this.context && !this._create()) {
      return false;
    }
    if (this.context.state === 'suspended') {
      try {
        await this.context.resume();
      } catch {
        return false;
      }
    }
    this.enabled = true;
    this._preference = true;
    this._persist();
    if (!this.started) {
      this.started = true;
      this.playMelody();
    }
    return true;
  }

  /** Turn the music off. */
  disable() {
    this.enabled = false;
    this._preference = false;
    this._persist();
    if (this.master) {
      const now = this.context.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(0.0001, now + 0.25);
    }
    return true;
  }

  /** Flip between on and off, returning the new state. */
  async toggle() {
    if (this.enabled) {
      this.disable();
      return false;
    }
    const ok = await this.enable();
    if (ok && this.master) {
      // Restore the volume that `disable` ramped away.
      const now = this.context.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(0.0001, now);
      this.master.gain.linearRampToValueAtTime(0.9, now + 0.25);
    }
    return this.enabled;
  }

  /** The birthday song. */
  playMelody() {
    if (!this.context || !this.enabled) {
      return;
    }

    const beat = 60 / 104;
    let time = this.context.currentTime + 0.2;

    for (const phrase of MELODY) {
      for (const [frequency, beats] of phrase) {
        this._voice(frequency, time, beats * beat * 0.94);
        time += beats * beat;
      }
    }

    // A short fanfare to close.
    const flourish = [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6];
    flourish.forEach((frequency, index) => {
      this._voice(frequency, time + index * 0.13, 0.45, 0.15);
    });
    this._chord(time + 0.62, [NOTE.C5, NOTE.E5, NOTE.G5], 2.4);
  }

  /** One synth voice: a triangle with a quiet octave harmonic. */
  _voice(frequency, when, duration, peak = 0.16) {
    const ctx = this.context;
    const osc = ctx.createOscillator();
    const harmonic = ctx.createOscillator();
    const harmonicGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const envelope = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.value = frequency;
    harmonic.type = 'sine';
    harmonic.frequency.value = frequency * 2;
    harmonicGain.gain.value = 0.22;

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3400, when);
    filter.frequency.exponentialRampToValueAtTime(1500, when + Math.max(0.2, duration));

    envelope.gain.setValueAtTime(0.0001, when);
    envelope.gain.exponentialRampToValueAtTime(peak, when + 0.03);
    envelope.gain.exponentialRampToValueAtTime(peak * 0.55, when + 0.14);
    envelope.gain.setValueAtTime(peak * 0.55, when + Math.max(0.15, duration * 0.62));
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);

    osc.connect(filter);
    harmonic.connect(harmonicGain);
    harmonicGain.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.master);

    osc.start(when);
    harmonic.start(when);
    osc.stop(when + duration + 0.06);
    harmonic.stop(when + duration + 0.06);
  }

  /** A sustained chord. */
  _chord(when, frequencies, duration) {
    frequencies.forEach((frequency, index) => {
      this._voice(frequency, when + index * 0.012, duration, 0.07);
    });
  }

  /** White noise, generated once and reused. */
  _noiseBuffer() {
    if (this._noise) {
      return this._noise;
    }
    const length = Math.floor(this.context.sampleRate * 0.6);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    this._noise = buffer;
    return buffer;
  }

  /** The pop of a firework. */
  crackle(intensity = 1) {
    if (!this.enabled || !this.context) {
      return;
    }
    const ctx = this.context;
    const source = ctx.createBufferSource();
    source.buffer = this._noiseBuffer();

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900 + Math.random() * 2400;
    filter.Q.value = 0.7;

    const envelope = ctx.createGain();
    const now = ctx.currentTime;
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(0.09 * intensity, now + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.master);
    source.start(now);
    source.stop(now + 0.34);
  }

  /** The low boom of the finale. */
  boom() {
    if (!this.enabled || !this.context) {
      return;
    }
    const ctx = this.context;
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.6);

    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(0.3, now + 0.02);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

    osc.connect(envelope);
    envelope.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.9);
  }

  /** A bright ping when the palette changes. */
  ping() {
    if (!this.enabled || !this.context) {
      return;
    }
    const now = this.context.currentTime;
    this._voice(880, now, 0.22, 0.07);
    this._voice(1320, now + 0.06, 0.3, 0.05);
  }
}
