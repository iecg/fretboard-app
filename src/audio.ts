class GuitarSynth {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterGain: GainNode | null = null;

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.value = 0.5; // Slightly louder clean signal
    }
  }

  setMute(mute: boolean) {
    this.isMuted = mute;
  }

  async playNote(frequency: number) {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    // Use a clean sine/triangle hybrid approach. Triangle provides warm harmonics.
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);

    const now = this.ctx.currentTime;
    const attackTime = 0.01;
    const decayTime = 1.0;
    const releaseTime = 1.0;

    // Amplitude Envelope (natural string decay)
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(1, now + attackTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + attackTime + decayTime + releaseTime);

    // Warm dampening filter
    filter.type = 'lowpass';
    filter.Q.value = 1;
    filter.frequency.setValueAtTime(frequency * 3, now);
    filter.frequency.exponentialRampToValueAtTime(frequency, now + attackTime + decayTime);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + attackTime + decayTime + releaseTime + 0.1);
  }
}

export const synth = new GuitarSynth();
