# Funk Pluck Buzz/Rattle Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kill the buzzy/rattly "loose strings" timbre on the funk chord pluck by reducing the noise that recirculates through the comb filter, without touching the resonance that makes stabs ring.

**Architecture:** `Tone.PluckSynth` (Karplus-Strong) is a noise burst recirculating through a damped comb filter. The buzz is *noise that rings* — caused by a noisy excitation (`attackNoise`) kept bright (`dampening`) and sustained by high feedback (`resonance: 0.9`, raised last fix). Fix at the source: damp the string faster (`dampening` ↓), clean the pick (`attackNoise` ↓), stop boosting the residual grit (`eq3 high` ↓). Leave `resonance` at 0.9 so the just-fixed ring/choke articulation is preserved and the `resonance ≥ 0.85` recurrence guard still holds.

**Tech Stack:** TypeScript, Tone.js `PluckSynth`, Vitest. Single patch object in `src/progressions/audio/sound/instrumentPatches.ts`.

---

### Task 1: Retune the funk pluck patch to remove buzz

**Files:**
- Modify: `src/progressions/audio/sound/instrumentPatches.ts` (the `chord-funk-scratch` patch, ~lines 110-129)
- Test (verify only, no edit expected): `src/progressions/audio/sound/instrumentPatches.test.ts`

- [ ] **Step 1: Confirm the existing guard passes before the change (baseline)**

Run: `pnpm vitest run src/progressions/audio/sound/instrumentPatches.test.ts`
Expected: PASS (all funk-patch assertions green at the current values).

- [ ] **Step 2: Edit the three params + comment in the `chord-funk-scratch` patch**

In `src/progressions/audio/sound/instrumentPatches.ts`, replace the `chord-funk-scratch` patch body. The new `pluck.dampening` is `2800` (was `4500`), `pluck.attackNoise` is `0.9` (was `1.2`), and the `eq3.high` is `1` (was `3`). `resonance`, `release`, `noteDurationSec`, `releaseTailSec`, and `strumLagSec` are UNCHANGED. Replace the comment to explain the buzz mechanism.

```ts
  {
    id: "chord-funk-scratch", label: "Funk Scratch", family: "strum",
    strum: {
      // Karplus-Strong single-coil funk guitar: a real plucked string with a
      // bright pick attack. The synth is a noise burst recirculating through a
      // damped comb filter, so three params must balance:
      //  - resonance HIGH (~0.9): a pluck's decay is the comb feedback, NOT the
      //    note-hold duration. At low resonance every note decays in ~70ms and
      //    nothing rings (stabs/root collapse into uniform ghost clicks). At ~0.9
      //    the ring outlasts the choke window, so durationSec (via the release
      //    ramp) governs choke-vs-ring: ghosts (0.06s) choke, stabs/color (0.4s)
      //    ring, root (0.12s) sustains briefly.
      //  - dampening MODERATE (~2800): the comb's lowpass. High feedback rings
      //    whatever is in the string, so a bright dampening keeps the NOISE
      //    ringing and the string sounds buzzy/rattly ("loose"). A lower
      //    dampening sheds highs faster each pass, settling the rattle into a
      //    warm pitched tone within a few cycles while the fundamental still rings.
      //  - attackNoise MODEST (~0.9): less grit in the excitation at the source.
      // eq3 high is a gentle +1 (not +3) so it doesn't re-amplify residual buzz.
      // Tight strumLagSec so the chord lands as a single stab. Velocity is scaled
      // by string.ts's gain stage (PluckSynth itself ignores velocity).
      pluck: { attackNoise: 0.9, dampening: 2800, resonance: 0.9, release: 0.12 },
      noteDurationSec: 0.18,
      releaseTailSec: 0.4,
      strumLagSec: 0.007,
    },
    insert: { eq3: { low: -2, mid: 1, high: 1 } },
  },
```

- [ ] **Step 3: Run the funk-patch test to confirm the guard still holds**

Run: `pnpm vitest run src/progressions/audio/sound/instrumentPatches.test.ts`
Expected: PASS. The guard asserts `resonance ≥ 0.85` (still 0.9), `strumLagSec ≤ 0.01` (still 0.007), `noteDurationSec ≤ 0.3` (still 0.18) — all unchanged, so it stays green. `dampening`/`attackNoise`/`eq3` are by-ear dials with no frozen assertion.

- [ ] **Step 4: Full verification gate**

Run: `pnpm run lint && pnpm run test && pnpm run build`
Expected: lint clean, all tests pass, build succeeds (`tsc -b` exit 0 — do not trust IDE diagnostics; the shell exit code is ground truth).

- [ ] **Step 5: Commit**

```bash
git add src/progressions/audio/sound/instrumentPatches.ts
git commit -m "fix(progressions): tame funk pluck buzz via dampening + attackNoise

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

(Commit subject is lowercase per commitlint. The lint-staged "could not find any staged files" line is harmless.)

---

### Verification (by ear — user)

Audio timbre cannot be unit-tested. After the gate is green and pushed to PR #489, the user auditions the **Funk** genre and confirms the chords now read as clean plucked stabs rather than buzzy/rattly slack strings — while the one / stab / color up-strums still ring as distinct events (the prior ring fix must survive). If it's now too dull/woody, `dampening` nudges back up toward ~3500; if buzz survives, `attackNoise` drops further toward ~0.7.
