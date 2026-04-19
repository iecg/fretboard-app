/**
 * GuitarSynth: A optimized Web Audio synthesizer for guitar-like tones.
 * Uses node pooling and explicit lifecycle management to minimize latency and memory leaks.
 */

const AUDIO_CONFIG = {
  MASTER_GAIN: 0.5,
  POOL_SIZE: 8,

  ATTACK_TIME: 0.005,
  DECAY_TIME: 1.0,
  RELEASE_TIME: 1.0,

  ENVELOPE_MIN_VALUE: 0.001,

  FILTER_Q: 1,
  FILTER_FREQ_INIT_MULTIPLIER: 6,
  FILTER_FREQ_FIRST_TARGET_MULTIPLIER: 1.5,
  FILTER_DAMPING_TIME: 0.15,

  MUTE_TRANSITION_TIME: 0.02,

  SILENT_OSC_STOP: 0.001,
  STOP_BUFFER: 0.1,
} as const;

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
  private readonly POOL_SIZE = AUDIO_CONFIG.POOL_SIZE;

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
      this.masterGain.gain.value = AUDIO_CONFIG.MASTER_GAIN;

      // Create a custom periodic wave that mimics a plucked string
      // Fundamental + overtones with decreasing amplitude
      const real = new Float32Array([0, 1, 0.6, 0.4, 0.3, 0.2, 0.1, 0.06]);
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
        silentOsc.stop(AUDIO_CONFIG.SILENT_OSC_STOP);
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
      this.masterGain.gain.setTargetAtTime(mute ? 0 : AUDIO_CONFIG.MASTER_GAIN, now, AUDIO_CONFIG.MUTE_TRANSITION_TIME);
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
    const { ATTACK_TIME, DECAY_TIME, RELEASE_TIME, ENVELOPE_MIN_VALUE, FILTER_Q, FILTER_FREQ_INIT_MULTIPLIER, FILTER_FREQ_FIRST_TARGET_MULTIPLIER, FILTER_DAMPING_TIME, STOP_BUFFER } = AUDIO_CONFIG;

    // Amplitude Envelope (natural string decay)
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(0, now);
    voice.gain.gain.linearRampToValueAtTime(1, now + ATTACK_TIME);
    voice.gain.gain.exponentialRampToValueAtTime(ENVELOPE_MIN_VALUE, now + ATTACK_TIME + DECAY_TIME + RELEASE_TIME);

    // Dynamic Filter (the "pluck" effect)
    // Initially open wide to let harmonics through, then close quickly to simulate damping.
    voice.filter.type = 'lowpass';
    voice.filter.Q.value = FILTER_Q;
    voice.filter.frequency.setValueAtTime(frequency * FILTER_FREQ_INIT_MULTIPLIER, now);
    voice.filter.frequency.exponentialRampToValueAtTime(frequency * FILTER_FREQ_FIRST_TARGET_MULTIPLIER, now + ATTACK_TIME + FILTER_DAMPING_TIME);
    voice.filter.frequency.exponentialRampToValueAtTime(frequency, now + ATTACK_TIME + DECAY_TIME);

    osc.connect(voice.filter);
    
    osc.start(now);
    const stopTime = now + ATTACK_TIME + DECAY_TIME + RELEASE_TIME + STOP_BUFFER;
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
