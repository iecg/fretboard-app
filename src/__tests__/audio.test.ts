import { describe, it, expect, beforeEach, vi } from 'vitest';
import { synth } from '../audio';

// Mock the Web Audio API
const mockAudioContext = {
  createGain: vi.fn(),
  createOscillator: vi.fn(),
  createBiquadFilter: vi.fn(),
  resume: vi.fn(),
  currentTime: 0,
  state: 'running',
  destination: {} as AudioDestinationNode,
};

const mockGainNode = {
  connect: vi.fn(),
  gain: {
    value: 0.5,
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  },
};

const mockOscillator = {
  type: 'sine',
  frequency: {
    setValueAtTime: vi.fn(),
  },
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
};

const mockFilter = {
  type: 'lowpass',
  Q: { value: 1 },
  frequency: {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  },
  connect: vi.fn(),
};

describe('GuitarSynth', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton state so each test gets a fresh AudioContext
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (synth as any).ctx = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (synth as any).masterGain = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (synth as any).isMuted = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (synth as any).unsupported = false;

    // Setup mock returns
    mockAudioContext.createGain.mockReturnValue(mockGainNode as unknown as GainNode);
    mockAudioContext.createOscillator.mockReturnValue(mockOscillator as unknown as OscillatorNode);
    mockAudioContext.createBiquadFilter.mockReturnValue(mockFilter as unknown as BiquadFilterNode);
    mockAudioContext.state = 'running';

    // Replace window.AudioContext with our mock — must use a regular function,
    // not an arrow function, so it can be called with `new`.
    (window as unknown as { AudioContext: typeof AudioContext }).AudioContext =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.fn(function() { return mockAudioContext; }) as any;
  });

  describe('init', () => {
    it('creates AudioContext on first call', () => {
      synth.init();
      expect(mockAudioContext.createGain).toHaveBeenCalled();
      expect(mockGainNode.connect).toHaveBeenCalledWith(mockAudioContext.destination);
    });

    it('sets master gain to 0.5', () => {
      synth.init();
      expect(mockGainNode.gain.value).toBe(0.5);
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

    it('no-ops safely when WebAudio is unsupported', async () => {
      // Simulate an environment without AudioContext.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).AudioContext;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).webkitAudioContext;

      await expect(synth.playNote(440)).resolves.toBeUndefined();
    });

    it('marks the synth unsupported when AudioContext construction fails', async () => {
      const throwingCtor = vi.fn(function() {
        throw new Error('AudioContext blocked');
      });
      (window as unknown as { AudioContext: typeof AudioContext }).AudioContext =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        throwingCtor as any;

      await expect(synth.playNote(440)).resolves.toBeUndefined();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((synth as any).unsupported).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((synth as any).ctx).toBeNull();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((synth as any).masterGain).toBeNull();

      await synth.playNote(440);
      expect(throwingCtor).toHaveBeenCalledTimes(1);
      expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
    });
  });

  describe('setMute', () => {
    it('stores mute state', () => {
      synth.setMute(true);
      synth.playNote(440);
      expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
    });

    it('can unmute to allow playback', () => {
      synth.setMute(true);
      synth.playNote(440);
      expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();

      synth.setMute(false);
      synth.playNote(440);
      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    });
  });

  describe('playNote', () => {
    beforeEach(() => {
      synth.setMute(false);
    });

    it('does not play when muted', () => {
      synth.setMute(true);
      synth.playNote(440);
      expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
    });

    it('creates oscillator, filter, and gain nodes', () => {
      synth.playNote(440);
      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
      expect(mockAudioContext.createBiquadFilter).toHaveBeenCalled();
      expect(mockAudioContext.createGain).toHaveBeenCalled();
    });

    it('sets oscillator type to triangle', () => {
      synth.playNote(440);
      expect(mockOscillator.type).toBe('triangle');
    });

    it('sets frequency on oscillator', () => {
      synth.playNote(440);
      expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(
        440,
        expect.any(Number)
      );
    });

    it('sets filter type to lowpass', () => {
      synth.playNote(440);
      expect(mockFilter.type).toBe('lowpass');
    });

    it('sets filter frequency to 3x note frequency initially', () => {
      synth.playNote(440);
      expect(mockFilter.frequency.setValueAtTime).toHaveBeenCalledWith(
        440 * 3,
        expect.any(Number)
      );
    });

    it('connects nodes in correct order', () => {
      synth.playNote(440);
      expect(mockOscillator.connect).toHaveBeenCalledWith(mockFilter);
      expect(mockFilter.connect).toHaveBeenCalledWith(mockGainNode);
      expect(mockGainNode.connect).toHaveBeenCalledWith(expect.any(Object));
    });

    it('starts oscillator', () => {
      synth.playNote(440);
      expect(mockOscillator.start).toHaveBeenCalledWith(expect.any(Number));
    });

    it('stops oscillator after envelope duration', () => {
      synth.playNote(440);
      const stopCall = mockOscillator.stop.mock.calls[0];
      const startCall = mockOscillator.start.mock.calls[0];
      const duration = stopCall[0] - startCall[0];

      // Attack(0.01) + Decay(1.0) + Release(1.0) + buffer(0.1) ≈ 2.11
      expect(duration).toBeCloseTo(2.11, 1);
    });

    it('schedules gain envelope with attack', () => {
      synth.playNote(440);
      expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(0, expect.any(Number));
      expect(mockGainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        1,
        expect.any(Number)
      );
    });

    it('schedules decay and release with exponential ramp', () => {
      synth.playNote(440);
      expect(mockGainNode.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(
        0.001,
        expect.any(Number)
      );
    });

    it('plays different frequencies', () => {
      synth.playNote(262); // C4
      const call1 = mockOscillator.frequency.setValueAtTime.mock.calls[0];

      vi.clearAllMocks();
      mockAudioContext.createOscillator.mockReturnValue(mockOscillator as unknown as OscillatorNode);

      synth.playNote(440); // A4
      const call2 = mockOscillator.frequency.setValueAtTime.mock.calls[0];

      expect(call1[0]).toBe(262);
      expect(call2[0]).toBe(440);
    });
  });
});
