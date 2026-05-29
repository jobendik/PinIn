import { bus } from '@/core/EventBus';

/**
 * Web Audio API sound engine (blueprint §Acoustic Engineering).
 *
 * Browsers can't be trusted with <audio> tags for low-latency arcade feedback,
 * so everything here is synthesised through an AudioContext: zero-latency
 * one-shot SFX (flippers, dots, checkpoints, impacts) plus a generative,
 * sample-accurate-scheduled synthwave bed whose key/tempo crossfades per biome.
 *
 * All audio is procedurally generated — no external/third-party tracks.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private muted = false;

  // Generative-music scheduler state.
  private scheduling = false;
  private nextNoteTime = 0;
  private step = 0;
  private timerId = 0;
  private scale: number[] = [0, 3, 5, 7, 10]; // minor pentatonic
  private rootHz = 220;
  private readonly tempo = 112; // BPM

  constructor() {
    // Wire SFX to gameplay events so systems stay decoupled.
    bus.on('flipper:actuate', () => this.flipper());
    bus.on('dot:collected', () => this.dot());
    bus.on('checkpoint:crossed', () => this.checkpoint());
    bus.on('ball:nudge', () => this.nudge());
    bus.on('powerup:activated', () => this.powerup());
    bus.on('ball:collide', ({ speed }) => {
      if (speed > 18) this.impact(speed);
    });
  }

  /** Must be called from a user gesture (autoplay policy). Idempotent. */
  resume(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.0;
      this.musicGain.connect(this.master);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.sfxGain.connect(this.master);
    }
    void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.8;
  }

  /** Begin the generative music bed. */
  startMusic(): void {
    if (!this.ctx || this.scheduling) return;
    this.scheduling = true;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.fadeMusic(0.32, 1.5);
    this.scheduleLoop();
  }

  stopMusic(): void {
    this.scheduling = false;
    window.clearTimeout(this.timerId);
    this.fadeMusic(0, 0.6);
  }

  /** Crossfade the musical key/scale when the biome changes. */
  setBiome(index: number): void {
    // Shift the root up a perfect-fourth-ish each biome; cycle scales for colour.
    const roots = [220, 246.94, 261.63, 196, 293.66, 174.61, 233.08, 207.65];
    this.rootHz = roots[Math.abs(index) % roots.length];
    const scales = [
      [0, 3, 5, 7, 10],
      [0, 2, 3, 7, 9],
      [0, 2, 4, 7, 9],
      [0, 3, 5, 6, 10],
    ];
    this.scale = scales[Math.abs(index) % scales.length];
  }

  // -------------------------------------------------------------- SFX --- //

  private env(
    type: OscillatorType,
    freq: number,
    duration: number,
    gain: number,
    sweepTo?: number,
  ): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (sweepTo !== undefined) osc.frequency.exponentialRampToValueAtTime(sweepTo, t + duration);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g).connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  private flipper(): void {
    this.env('square', 140, 0.08, 0.25, 90);
  }
  private dot(): void {
    this.env('triangle', 880, 0.12, 0.3, 1320);
  }
  private checkpoint(): void {
    this.env('sawtooth', 330, 0.5, 0.3, 660);
    this.env('triangle', 660, 0.6, 0.2, 990);
  }
  private nudge(): void {
    this.env('sine', 80, 0.18, 0.4, 50);
  }
  private powerup(): void {
    this.env('sawtooth', 440, 0.35, 0.3, 1760);
  }
  private impact(speed: number): void {
    const g = Math.min(0.35, 0.05 + speed * 0.004);
    this.env('triangle', 200, 0.06, g, 120);
  }

  gameOver(): void {
    this.env('sawtooth', 220, 1.2, 0.35, 55);
  }

  // ------------------------------------------------ Generative music --- //

  private scheduleLoop = (): void => {
    if (!this.ctx || !this.scheduling) return;
    const secondsPerStep = 60 / this.tempo / 2; // eighth notes
    while (this.nextNoteTime < this.ctx.currentTime + 0.2) {
      this.playStep(this.step, this.nextNoteTime, secondsPerStep);
      this.nextNoteTime += secondsPerStep;
      this.step = (this.step + 1) % 16;
    }
    this.timerId = window.setTimeout(this.scheduleLoop, 40);
  };

  private playStep(step: number, time: number, dur: number): void {
    if (!this.ctx || !this.musicGain) return;

    // Bassline on the downbeats.
    if (step % 4 === 0) {
      this.note('sawtooth', this.rootHz / 2, time, dur * 3.2, 0.18);
    }
    // Arpeggio across the scale.
    const degree = this.scale[(step + (step >> 2)) % this.scale.length];
    const octave = step % 8 < 4 ? 1 : 2;
    const hz = this.rootHz * Math.pow(2, (degree + octave * 12) / 12);
    if (step % 2 === 0 || step % 3 === 0) {
      this.note('triangle', hz, time, dur * 1.6, 0.1);
    }
  }

  private note(type: OscillatorType, hz: number, time: number, dur: number, gain: number): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = hz;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(g).connect(this.musicGain);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  private fadeMusic(to: number, seconds: number): void {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(t);
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, t);
    this.musicGain.gain.linearRampToValueAtTime(to, t + seconds);
  }
}
