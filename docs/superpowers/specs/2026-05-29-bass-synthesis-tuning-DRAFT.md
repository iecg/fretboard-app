# Bass Synthesis and Tuning

## Goal
Improve the sonic quality of the synthesized bass instrument so it accurately reflects a real electric or upright bass, providing a stronger foundation for the backing track.

## Objectives
1. **Tone Polish:** Move away from raw or muddy synthesized sounds. 
2. **Envelope Shaping:** Adjust the ADSR envelope to ensure punchy attacks and natural decay, avoiding endless sustain or abrupt clicks.
3. **Timbral Realism:** Use FM synthesis or filtering to emulate the harmonics of bass strings. 
4. **Mix Integration:** Balance the low end so it anchors the mix without clashing with the kick drum.

## Implementation Plan
1. **Synth Audition:** Open `instruments/bass.ts` and adjust the Tone.js `FMSynth` or `MonoSynth` configuration. 
2. **Parameters:**
   - Set a sharp attack (e.g., 0.01s).
   - Set a moderate decay (0.2s).
   - Set sustain level to mimic a plucked string (e.g., 0.2).
   - Adjust harmonicity and modulation index if using FM.
3. **Effects Chain:** Consider adding a subtle low-pass filter or light saturation/distortion to warm up the sound. 
4. **Testing:** Render the bass track alongside the drums to verify it cuts through without overpowering.
