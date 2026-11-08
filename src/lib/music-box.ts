// Retro music-box background melody, synthesised entirely with the Web Audio
// API so no external audio files need to be loaded. The tune is "Greensleeves",
// a classic music-box melody, rendered with a bright, ringing tine timbre.
export class MusicBoxAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: number | null = null;
  private nextNoteTime = 0;
  private noteIndex = 0;
  private readonly beat = 0.5; // seconds per quarter note

  // [frequency, duration in beats] — Greensleeves in A minor.
  private readonly melody: [number, number][] = [
    [440, 1], [392, 0.5], [369.99, 0.5], [329.63, 2],
    [293.66, 2], [329.63, 1], [369.99, 1], [392, 2],
    [440, 1], [392, 0.5], [369.99, 0.5], [329.63, 2],
    [293.66, 2], [329.63, 1], [369.99, 3],
  ];
  // Soft low accompaniment played on the downbeat of each bar (aligned to melody).
  private readonly bass: (number | null)[] = [
    110, null, null, null,
    73.42, null, null, null,
    110, null, null, null,
    73.42, null, null, null,
  ];

  private ensureContext() {
    this.context ??= new AudioContext();
    if (!this.master) {
      this.master = this.context.createGain();
      this.master.gain.value = 0.13;
      this.master.connect(this.context.destination);
    }
  }

  start() {
    try {
      this.ensureContext();
      const a = this.context!;
      if (this.timer !== null) return; // already playing
      this.noteIndex = 0;
      this.nextNoteTime = a.currentTime + 0.1;
      this.timer = window.setInterval(() => this.schedule(), 25);
      void a.resume();
    } catch {
      /* Background music is a nice-to-have; ignore when audio is unavailable. */
    }
  }

  stop() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private schedule() {
    const a = this.context;
    if (!a || this.timer === null) return;
    while (this.nextNoteTime < a.currentTime + 0.12) {
      const [frequency, beats] = this.melody[this.noteIndex];
      this.playTone(frequency, this.nextNoteTime, 1.7, 0.5);
      const bass = this.bass[this.noteIndex];
      if (bass) this.playTone(bass, this.nextNoteTime, 2.4, 0.22);
      this.nextNoteTime += beats * this.beat;
      this.noteIndex = (this.noteIndex + 1) % this.melody.length;
    }
  }

  private playTone(frequency: number, time: number, decay: number, peak: number) {
    const a = this.context!;
    // A music-box tine rings with a fundamental plus a couple of bright partials.
    const partials: [number, number][] = [
      [1, 1],
      [2, 0.35],
      [2.76, 0.14],
    ];
    for (const [ratio, weight] of partials) {
      const osc = a.createOscillator();
      const gain = a.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency * ratio;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(peak * weight, time + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
      osc.connect(gain).connect(this.master!);
      osc.start(time);
      osc.stop(time + decay + 0.05);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    }
  }

  dispose() {
    this.stop();
    void this.context?.close();
    this.context = null;
    this.master = null;
  }
}
