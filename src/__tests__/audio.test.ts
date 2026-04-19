import { describe, it, expect, beforeEach, vi } from 'vitest';
import { synth } from '../audio';

// Mock the Web Audio API
const createMockGainNode = () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  gain: {
    value: 1.0,
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
  },
});

const createMockOscillator = () => ({
  type: 'sine',
  frequency: {
    setValueAtTime: vi.fn(),
  },
  connect: vi.fn(),
  disconnect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  onended: null as null | (() => void),
  setPeriodicWave: vi.fn(),
});

const createMockFilter = () => ({
  type: 'lowpass',
  Q: { value: 1 },
  frequency: {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  },
  connect: vi.fn(),
  disconnect: vi.fn(),
});

const mockAudioContext = {
  createGain: vi.fn(),
  createOscillator: vi.fn(),
  createBiquadFilter: vi.fn(),
  createPeriodicWave: vi.fn().mockReturnValue({} as PeriodicWave),
  resume: vi.fn(),
  currentTime: 0,
  state: 'running',
  destination: {} as AudioDestinationNode,
};

describe('GuitarSynth', () => {
  let masterGain: ReturnType<typeof createMockGainNode>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (synth as any).ctx = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (synth as any).masterGain = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (synth as any).isMuted = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (synth as any).unsupported = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (synth as any).voicePool = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (synth as any).guitarWave = null;

    masterGain = createMockGainNode();
    
    // Setup mock returns to provide unique nodes for each call
    mockAudioContext.createGain.mockImplementation(() => createMockGainNode());
    // The first gain node created in init() is the master gain
    mockAudioContext.createGain.mockReturnValueOnce(masterGain);
    
    mockAudioContext.createOscillator.mockImplementation(() => createMockOscillator());
    mockAudioContext.createBiquadFilter.mockImplementation(() => createMockFilter());
    mockAudioContext.state = 'running';

    (window as unknown as { AudioContext: unknown }).AudioContext =
      vi.fn(function() { return mockAudioContext; }) as unknown as typeof AudioContext;
  });

  describe('init', () => {
    it('creates AudioContext on first call', () => {
      synth.init();
      expect(mockAudioContext.createGain).toHaveBeenCalled();
      expect(masterGain.connect).toHaveBeenCalledWith(mockAudioContext.destination);
    });

    it('sets master gain to 0.5', () => {
      synth.init();
      expect(masterGain.gain.value).toBe(0.5);
    });

    it('creates a custom guitar waveform', () => {
      synth.init();
      expect(mockAudioContext.createPeriodicWave).toHaveBeenCalled();
    });

    it('pre-allocates a voice pool', () => {
      synth.init();
      // 1 master gain + 8 pool voices + 1 warmup gain = 10 calls
      expect(mockAudioContext.createGain).toHaveBeenCalledTimes(10);
      // 8 pool filters
      expect(mockAudioContext.createBiquadFilter).toHaveBeenCalledTimes(8);
    });

    it('performs a warmup', () => {
      synth.init();
      // Warmup oscillator
      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(1);
    });

    it('resumes context if suspended', async () => {
      mockAudioContext.state = 'suspended';
      await synth.playNote(440);
      expect(mockAudioContext.resume).toHaveBeenCalled();
    });

    it('does not create context twice', () => {
      synth.init();
      const callCount1 = mockAudioContext.createGain.mock.calls.length;
      synth.init();
      const callCount2 = mockAudioContext.createGain.mock.calls.length;
      expect(callCount2).toBe(callCount1);
    });
  });

  describe('setMute', () => {
    it('stores mute state and affects master gain', () => {
      synth.init();
      synth.setMute(true);
      expect(masterGain.gain.setTargetAtTime).toHaveBeenCalledWith(0, expect.any(Number), 0.02);
      
      // Note should not play when muted
      vi.clearAllMocks();
      synth.playNote(440);
      // It might call createOscillator during init if not already init'd, 
      // but here we already called init().
      // playNote checks isMuted before init()
      expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
    });

    it('can unmute to allow playback', () => {
      synth.init();
      synth.setMute(true);
      synth.setMute(false);
      expect(masterGain.gain.setTargetAtTime).toHaveBeenCalledWith(0.5, expect.any(Number), 0.02);

      synth.playNote(440);
      // 1 for playNote (warmup already happened during init)
      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    });
  });

  describe('playNote', () => {
    beforeEach(() => {
      synth.setMute(false);
    });

    it('creates a new oscillator and uses a pooled voice', async () => {
      synth.init();
      vi.clearAllMocks();
      
      await synth.playNote(440);
      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(1);
      // Filter and Gain should NOT be created again if pool is used
      expect(mockAudioContext.createBiquadFilter).not.toHaveBeenCalled();
      expect(mockAudioContext.createGain).not.toHaveBeenCalled();
    });

    it('applies the custom guitar waveform', async () => {
      await synth.playNote(440);
      const oscillators = mockAudioContext.createOscillator.mock.results;
      const osc = oscillators[oscillators.length - 1].value;
      expect(osc.setPeriodicWave).toHaveBeenCalled();
    });

    it('stops oscillator after envelope duration', async () => {
      await synth.playNote(440);
      const oscillators = mockAudioContext.createOscillator.mock.results;
      const osc = oscillators[oscillators.length - 1].value;
      
      const stopCall = osc.stop.mock.calls[0];
      const startCall = osc.start.mock.calls[0];
      const duration = stopCall[0] - startCall[0];

      // Attack(0.005) + Decay(1.0) + Release(1.0) + buffer(0.1) ≈ 2.105
      expect(duration).toBeCloseTo(2.105, 1);
    });

    it('disconnects oscillator on ended', async () => {
      await synth.playNote(440);
      const oscillators = mockAudioContext.createOscillator.mock.results;
      const osc = oscillators[oscillators.length - 1].value;
      
      expect(osc.onended).toBeTypeOf('function');
      osc.onended();
      expect(osc.disconnect).toHaveBeenCalled();
    });
  });
});
