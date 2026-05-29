# Backing-Track Drum Realism / Samples (Slice D) — DRAFT

**Status:** DRAFT outline — not implementation-ready. Needs its own brainstorming pass before a plan.
**Date:** 2026-05-28
**Predecessors:** audit `2026-05-21-backing-track-tonal-audit.md`; sound/mix slice `2026-05-28-backing-track-sound-and-mix-design.md`.
**Theme:** Drum samples drive ~80% of perceived production value in a backing track (audit Win #4). Slice A+B refines the *synthesized* kit per genre; this slice optionally moves to real samples for the biggest single perceptual jump. Tackle after A+B (and likely after C).

---

## Goal

Replace (or augment) the synthesized `MembraneSynth`/`NoiseSynth`/`MetalSynth` kit with real drum samples for a convincingly produced groove.

## Candidate scope (to be refined in brainstorming)

1. **Sample playback via `Tone.Players`.**
   - Load a compact kit (kick / snare / closed-hat / open-hat / ride, maybe rim/clap). Velocity → `volume` (+ optional `playbackRate` micro-variation). Replace `drumKit.ts` `schedule*` helpers.

2. **Per-genre kits.**
   - Mirror the A+B `kit-*` patch IDs with sample sets (acoustic-rock, funk, jazz-brush, blues, ballad, bossa). Genre mix preset selects the kit.

3. **Round-robin / velocity layers** (quality vs bundle tradeoff).
   - Multiple samples per drum per velocity range to avoid the "machine-gun" repeated-hit effect. Costs bundle size.

4. **Quality-tier integration.**
   - Tie into the A+B `qualityTiers` system: eco = synthesized kit (no download), standard = single-sample kit, high = velocity-layered/round-robin. Keeps mobile light.

## Key decisions / open questions

- **Asset strategy:** bundle in repo (GitHub Pages size + deploy), lazy-load on first play, or host externally? CC0/royalty-free licensing required.
- **Bundle budget:** how many KB/MB acceptable for a GitHub Pages app? Likely lazy-load only when a sampled tier is active.
- **Format:** compressed (ogg/mp3 — decode cost, smaller) vs wav (instant, larger). Per-tier?
- **Fallback:** offline / load-failure path must fall back to the synthesized kit (slice A+B kit) gracefully.
- **Latency:** sample load must complete before the sampled kit is selectable, or first bar silently falls back.
- Keep the synthesized kit as the eco-tier path regardless — it's the no-network guarantee.

## Dependencies

- Builds on A+B `qualityTiers` + `genreMixPresets` (kit selection plugs into the same patch/mix system).
- Independent of C; can ship before or after.
