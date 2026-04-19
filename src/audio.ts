/**
 * GuitarSynth: A optimized Web Audio synthesizer for guitar-like tones.
 * Uses node pooling and explicit lifecycle management to minimize latency and memory leaks.
 */

interface Voice {
  gain: GainNode;
  filter: BiquadFilterNode;
  active: boolean;
}

class GuitarSynth {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterGain: GainNode | null = null;
  private unsupported: boolean = false;
  private guitarWave: PeriodicWave | null = null;

  // Voice pool to reduce node creation overhead
  private voicePool: Voice[] = [];
  private readonly POOL_SIZE = 8;

  private getAudioContextConstructor():
    | (new () => AudioContext)
    | undefined {
    const w = window as Window & {
      AudioContext?: new () => AudioContext;
      webkitAudioContext?: new () => AudioContext;
    };
    return w.AudioContext ?? w.webkitAudioContext;
  }

  init() {
    if (this.unsupported || this.ctx) return;

    const AudioContextCtor = this.getAudioContextConstructor();
    if (!AudioContextCtor) {
      this.unsupported = true;
      return;
    }

    try {
      this.ctx = new AudioContextCtor();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.value = 0.5;

      // Create a custom periodic wave that mimics a plucked string
      // Fundamental + overtones with decreasing amplitude
      const real = new Float32Array([0, 1, 0.6, 0.4, 0.3, 0.2, 0.1, 0.05]);
      const imag = new Float32Array(real.length).fill(0);
      this.guitarWave = this.ctx.createPeriodicWave(real, imag);

      // Pre-allocate voice pool
      for (let i = 0; i < this.POOL_SIZE; i++) {
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        
        // Initial state: silent and disconnected
        gain.gain.value = 0;
        filter.connect(gain);
        gain.connect(this.masterGain);

        this.voicePool.push({ gain, filter, active: false });
      }

      // Warm up: create a silent oscillator to kickstart the context
      if (this.ctx.state !== 'closed') {
        const silentOsc = this.ctx.createOscillator();
        const silentGain = this.ctx.createGain();
        silentGain.gain.value = 0;
        silentOsc.connect(silentGain);
        silentGain.connect(this.ctx.destination);
        silentOsc.start(0);
        silentOsc.stop(0.001);
        silentOsc.onended = () => {
          silentOsc.disconnect();
          silentGain.disconnect();
        };
      }

    } catch {
      this.unsupported = true;
      this.ctx = null;
      this.masterGain = null;
    }
  }

  setMute(mute: boolean) {
    this.isMuted = mute;
    if (this.masterGain) {
      // Smoothly mute/unmute to avoid clicks
      const now = this.ctx?.currentTime ?? 0;
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.5, now, 0.02);
    }
  }

  private getAvailableVoice(): Voice | null {
    const voice = this.voicePool.find(v => !v.active);
    if (voice) return voice;
    
    // If pool is exhausted and we have a context, create a temporary voice
    if (this.ctx && this.masterGain) {
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      filter.connect(gain);
      gain.connect(this.masterGain);
      return { gain, filter, active: false };
    }
    
    return null;
  }

  async playNote(frequency: number) {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx || !this.masterGain || !this.guitarWave) return;

    // Ensure context is running (required for many browsers after a period of inactivity)
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (e) {
        // Fallback for browsers that block resume without user gesture
        console.warn('AudioContext resume failed:', e);
        return;
      }
    }

    const voice = this.getAvailableVoice();
    if (!voice) return;

    voice.active = true;
    const osc = this.ctx.createOscillator();
    
    // Use the custom guitar waveform
    osc.setPeriodicWave(this.guitarWave);
    osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);

    const now = this.ctx.currentTime;
    const attackTime = 0.005; // Sharper attack for better responsiveness
    const decayTime = 1.0;
    const releaseTime = 1.0;

    // Amplitude Envelope (natural string decay)
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(0, now);
    voice.gain.gain.linearRampToValueAtTime(1, now + attackTime);
    voice.gain.gain.exponentialRampToValueAtTime(0.001, now + attackTime + decayTime + releaseTime);

    // Dynamic Filter (the "pluck" effect)
    // Initially open wide to let harmonics through, then close quickly to simulate damping.
    voice.filter.type = 'lowpass';
    voice.filter.Q.value = 1;
    voice.filter.frequency.setValueAtTime(frequency * 6, now);
    voice.filter.frequency.exponentialRampToValueAtTime(frequency * 1.5, now + attackTime + 0.15); // Fast initial damping
    voice.filter.frequency.exponentialRampToValueAtTime(frequency, now + attackTime + decayTime);

    osc.connect(voice.filter);
    
    osc.start(now);
    const stopTime = now + attackTime + decayTime + releaseTime + 0.1;
    osc.stop(stopTime);

    osc.onended = () => {
      osc.disconnect();
      voice.active = false;
      
      // If this was a temporary voice (not in the pool), clean it up
      if (!this.voicePool.includes(voice)) {
        voice.filter.disconnect();
        voice.gain.disconnect();
      }
    };
  }
}

export const synth = new GuitarSynth();
