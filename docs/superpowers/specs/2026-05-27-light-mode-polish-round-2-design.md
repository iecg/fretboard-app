# Light-Mode Polish — Round 2 — Design

**Status:** Approved.

**Goal:** Close the visual and behavioral gaps left after the v2.0 shell restructure and the Lens Consolidation. Restore lead-lens and guide-tone emphasis visibility, rebalance the CAGED palette in light mode, fix chord-tone highlighting inside 3NPS shapes, and stop the orphan `#ffffff` hover state from breaking the warm-parchment palette.

**In scope (five issues):**

1. CAGED polygon contrast in light mode — E (`#56B4E9` sky blue) and A (`#0072B2` deep blue) read as the same blue family; D (`#999999` mid gray) is near-invisible against the warm cream surface.
2. Lead-lens and guide-tone glow emphasis are invisible in both modes — dead `[data-practice-lens="lead"]` selector gate plus a hardcoded `"cyan"` literal in `applyTonesBase` that never matches the CSS attribute selector expecting `"var(--note-glow-hold)"`.
3. Chord tones inside the active 3NPS shape but outside the chord-voicing connector path are not highlighted — `classifyNoteFromSemantics` is over-gating the chord-tone branches.
4. Hover state of progression degree buttons and chord-navigator buttons is pure `#ffffff` instead of the light-theme `--chrome-hover-bg` token.
5. Visual regression baseline refresh after the above land.

**Out of scope:** further refactor of the lens system; dark-mode tuning (touched only where a fix cuts across modes); degree-color palette; CAGED palette in dark mode unless re-tuning E cascades there; the broader theming-design re-tune of note fills (the values already in `themes.css` from the prior pass are not changed by this spec).

**Approach philosophy:** diagnose-and-fix, not redesign. Each issue has a confirmed mechanism (captured in §2). The spec commits to token targets where high-confidence and to investigation steps where the fix needs a focused diagnosis (issue 3 and issue 4 file discovery).

---

## §1 — Context

The v2.0 shell restructure (#451) and the prior theming pass landed the reference-palette tokens in `src/styles/themes.css` (BG `#ebebdc`, PANEL `#f6f2e9`, INK `#2a251d`, CYAN `#147088`, ORANGE `#b1431b`). The Lens Consolidation (#446) collapsed the practice-lens picker down to always-Lead. The CAGED-E recolor swapped `#E69F00` orange to `#56B4E9` sky blue.

Each of those landed correctly in isolation. The user-facing issues in this spec emerged at the seams:

- The CAGED-E sky-blue recolor stopped a collision with chord-tone-ring orange, but in light mode it now sits in the same hue family as CAGED-A. CAGED-D's neutral gray was tolerable on dark mode but vanishes against the warm cream PANEL.
- The Lens Consolidation removed the `data-practice-lens` attribute from the DOM but left the CSS selectors gated on it. The `applyTonesBase` fallback (which fires when no progression is active) still returns the pre-tokenization literal `"cyan"`.
- The 3NPS fingering mode renders an active shape whose fret-range may be narrower than the chord-voicing engine's `isChordInRange` window. The intersection of those two gates excludes positions the user expects to see highlighted.
- The DAW-shell progression and chord-navigator buttons hover into pure `#ffffff` somewhere in their CSS-module ownership, missing the warm-parchment palette's `--chrome-hover-bg: #ddd8cf`.

---

## §2 — Architecture / root causes

### Issue 1 — CAGED contrast (light mode)

- Token sites: `src/styles/themes.css:194-199` (`--caged-*-bg` boosted alphas inside `[data-theme="modern-light"]`) and `src/styles/themes.css:363-372` (the `[data-theme="modern-dark"]` block sets both `--caged-*` outline and `--caged-*-bg` fill). `:root` defaults live in `src/styles/index.css:20-34`.
- The `[data-theme="modern-light"]` block currently only overrides `--caged-*-bg` alphas. Outline color is inherited from `:root`, so light-mode CAGED-D and CAGED-E and CAGED-A inherit the dark-mode/Okabe-Ito outline hues.
- Root cause of the contrast issue: in light mode both E (`rgba(27,124,194,0.35)`) and A (`rgba(0,114,178,0.35)`) sit in the same blue family roughly 10% lightness apart. D's `rgba(153,153,153,0.35)` is achromatic gray over a warm cream surface — desaturates and reads as near-invisible.

### Issue 2 — Lens emphasis invisible

Two mechanisms compound:

- **Dead ancestor gate.** `src/components/FretboardSVG/FretboardSVG.module.css:388,393` requires `[data-practice-lens="lead"]` on an ancestor for the glow filter to apply. A grep across `src/` shows no producer of `data-practice-lens=` on any DOM element after Lens Consolidation. The CSS rule never fires.
- **Hardcoded literal.** `src/components/FretboardSVG/utils/semantics.ts:58` — `applyTonesBase` returns `glowColor: "cyan"` (string literal) for the guide-tone branch. The CSS attribute selector `[data-lens-emphasis="var(--note-glow-hold)"]` does not match the literal `"cyan"` value. Even with the ancestor gate fixed, the guide-tone fallback path would still not paint its glow.

### Issue 3 — 3NPS chord-tone gating

- `classifyNoteFromSemantics` (`src/components/FretboardSVG/utils/semantics.ts:148-169`) gates every chord-tone branch on `isInActiveShape && isChordInRange`.
- Hypothesis (confirmed during impl diagnosis): in 3NPS the active shape spans a fixed three-notes-per-string box; the chord-voicing engine's `isChordInRange` may use a narrower window (the voicing's actual fret span). Positions inside the 3NPS box but outside the voicing's fret span fall through both gates and end at `note-inactive`.
- The user's stated behavior contract: in 3NPS, every fret position inside the active shape whose pitch class is in the current chord gets chord-tone styling. Positions outside the shape remain `note-inactive`.

### Issue 4 — Hover `#ffffff`

- The progression degree buttons and chord-navigator buttons render a hover background of pure `#ffffff` (confirmed in the user's attached screenshot — the "A" button's hover state).
- The exact CSS rule producer is not yet pinpointed; the discovery is a small grep job during implementation (low risk of mislocation given the focused component set).
- The light-mode token `--chrome-hover-bg: #ddd8cf` already exists in `themes.css` and is the correct binding target.

---

## §3 — Design per issue

### Issue 1 — CAGED palette rebalance (light mode only)

| Shape | Current outline | Current bg (light) | New outline | New bg (light) | Rationale |
|---|---|---|---|---|---|
| E | `#56B4E9` | `rgba(27,124,194,0.35)` | `#56B4E9` (unchanged) | `rgba(86,180,233,0.35)` | Use the lighter `rgb(86,180,233)` of the actual outline hex with the same alpha; reads as airy sky blue, clearly lighter than A. |
| A | `#0072B2` | `rgba(0,114,178,0.35)` | `#0072B2` (unchanged) | `rgba(0,114,178,0.45)` | Hold the deep blue but push alpha to 0.45; reads as visibly darker than E's lighter rgb. |
| D | `#999999` | `rgba(153,153,153,0.35)` | `#6b5d4f` warm taupe | `rgba(107,93,79,0.40)` | Warm taupe is in the reference palette's MUTE family neighborhood. Drops the achromatic gray that desaturates against cream. |
| C | `#009E73` | `rgba(0,158,115,0.35)` | unchanged | unchanged | Bluish-green reads cleanly against cream. |
| G | `#CC79A7` | `rgba(204,121,167,0.35)` | unchanged | unchanged | Reddish purple reads cleanly. |

**Light-mode override structure:** the `[data-theme="modern-light"]` block grows an explicit `--caged-d` outline override (it currently inherits from `:root`). The `--caged-*-bg` block is re-tuned in place.

**Open trade-off:** the proposed D taupe `#6b5d4f` sits visually close to `--text-muted: #857c6c` (MUTE). If the polygon and surrounding muted text read as the same band on the same surface, fallback to a deeper olive `#6b7c4f` — same lightness, different hue, still in the earthy reference-palette neighborhood. Frontend-design or visual review during impl picks between the two.

**Dark mode:** untouched. The Okabe-Ito palette is the canonical reference; no user complaint in dark.

### Issue 2 — Lens emphasis re-wire

**CSS change** (`src/components/FretboardSVG/FretboardSVG.module.css`, lines around 388 and 393):

```css
/* before */
[data-practice-lens="lead"] .fretboard-note[data-lens-emphasis="var(--note-glow-hold)"] { filter: var(--fretboard-svg-glow-cyan-url); }
[data-practice-lens="lead"] .fretboard-note[data-lens-emphasis="var(--note-glow-anticipation)"] { filter: var(--fretboard-svg-glow-orange-url); }

/* after */
.fretboard-note[data-lens-emphasis="var(--note-glow-hold)"] { filter: var(--fretboard-svg-glow-cyan-url); }
.fretboard-note[data-lens-emphasis="var(--note-glow-anticipation)"] { filter: var(--fretboard-svg-glow-orange-url); }
```

Other rules in the same file that still gate on `[data-practice-lens=...]` (`guide-tones`, `tension`) are unrelated to the consolidation — they apply when explicit practice-lens modes are still active and stay as-is.

**TypeScript change** (`src/components/FretboardSVG/utils/semantics.ts`):

- `applyTonesBase` returns `glowColor: "var(--note-glow-hold)"` for the guide-tone branch (was `"cyan"`).
- `LensEmphasis.glowColor` type narrows: drop the `"cyan" | "orange" | "violet"` literals from the union; keep only `\`var(--${string})\``. No remaining producer should be on the literal form after this change — verified by grep at impl time.

**Glow-filter visibility.** The SVG `<filter>` defs in `src/components/FretboardSVG/FretboardSVG.tsx:200-204` bind `glowFilterUrls.cyan`/`.orange` into `--fretboard-svg-glow-cyan-url`/`-orange-url`. If after the dead-gate removal the light-mode glow still reads as too subtle ("highlight was too subtle when it showed" — the user's pre-CAGED-E-recolor complaint), the implementer tunes the `<feGaussianBlur stdDeviation>` and `<feFlood>` opacity inside the filter defs to lift visibility against the cream PANEL. Spec target: hold and anticipation glows are visually distinct against `#f6f2e9` at typical viewing distance.

### Issue 3 — 3NPS chord-tone coverage

**Implementation diagnosis steps (must run before code change):**

1. Reproduce: in light mode, select 3NPS fingering, set up C major with a 4-note voicing covering strings 1-4. Observe which positions inside the 3NPS shape are highlighted.
2. Trace one unhighlighted position. For that position, log `sem.isChordTone`, `isChordInRange`, `isInActiveShape`. Identify which gate excludes it.
3. If `isChordInRange` is the culprit: relax the chord-tone classification to use only `isInActiveShape` (drop `isChordInRange` from the chord-tone branches of `classifyNoteFromSemantics` at `semantics.ts:162-167`). The `isChordInRange` gate may still be useful for the connector-polyline rendering layer but should not constrain role classification.
4. If `isInActiveShape` is the culprit: investigate why a chord-tone position inside the 3NPS box reports `isInActiveShape: false`. Possibly the shape is being computed against a different chord/key context than the role classifier — fix the upstream input.

**Behavioral contract (the test target):** in 3NPS mode, every fret position inside the active shape whose pitch class belongs to the current chord receives one of the chord-tone classes (`chord-root`, `chord-tone-in-scale`, `chord-tone-outside-scale`, `note-diatonic-chord`). Positions outside the shape stay `note-inactive`.

### Issue 4 — Hover `#ffffff` discovery and fix

**Discovery (during impl):**

```bash
grep -rnE 'background.*#fff|background-color:\s*#fff|background:\s*white' \
  src/components/Progression* src/components/ChordOverlay* \
  src/components/ChordNavigator* src/components/StepperControl* \
  src/components/ToggleBar* src/components/shared/
```

Most likely producers: `ProgressionTrack`'s degree button styles, `ChordPicker` / `ChordNavigator` button styles, or a shared button primitive's hover rule.

**Fix:** route each offending hover background through `var(--chrome-hover-bg)`. If a component intentionally uses `#ffffff` to invert against a dark accent (e.g. a primary-CTA hover), that rule stays — review case-by-case during the grep pass.

---

## §4 — Files to touch

- **Modify** `src/styles/themes.css` — light-mode CAGED outline + bg-alpha re-tune (~10 lines). Add `--caged-d` outline override; re-tune `--caged-e-bg`, `--caged-a-bg`, `--caged-d-bg`.
- **Modify** `src/components/FretboardSVG/FretboardSVG.module.css` — drop `[data-practice-lens="lead"]` ancestor selectors on lines 388 and 393.
- **Modify** `src/components/FretboardSVG/utils/semantics.ts` — return `"var(--note-glow-hold)"` from `applyTonesBase` (line 58 area); narrow `LensEmphasis.glowColor` type union; relax chord-tone gates per issue-3 diagnosis.
- **Modify** `src/components/FretboardSVG/utils/semantics.test.ts` — add guide-tone-fallback assertion; add 3NPS-in-shape-chord-tone assertion.
- **Modify** one or more component CSS modules where the `#ffffff` hover background lives (exact files added to the implementation plan after the grep discovery — likely `ProgressionTrack`, `ChordPicker`/`ChordNavigator`, or a shared button primitive).
- **Optional** SVG glow filter defs in `src/components/FretboardSVG/FretboardSVG.tsx` — tune `stdDeviation` / flood opacity if light-mode glow reads too subtly after the gate is fixed.
- **Visual baselines** under `e2e/` — `pnpm run test:visual:update` after the four fix surfaces land. Expect changes in `app-components/fretboard-svg-*`, light-mode chord overlays, light-mode hover snapshots, possibly `app-overlays/` and `app-layout/`.

**No new files. No deletions. No new tokens.**

---

## §5 — Tests

**Unit / component (Vitest):**

- `semantics.test.ts` — extend with:
  - guide-tone-fallback path (`applyTonesBase` with `isGuideTone: true`) returns `glowColor: "var(--note-glow-hold)"`.
  - 3NPS-shape-with-out-of-voicing-chord-tone case: a fixture matching the bug's reproduction (position is inside the active shape, pitch class is in the active chord, but is excluded by today's gate combination) returns one of the chord-tone classes (not `note-inactive`). The exact fixture inputs follow from the issue-3 diagnosis (see §3).
- No new atom contracts. No store changes.

**Visual regression (Playwright):**

- Refresh darwin baselines: `pnpm run test:visual:update`.
- Expected diff: CAGED-* light-mode snapshots, hover-state snapshots on degree buttons and chord-navigator buttons, lens-emphasis-active snapshots (if the suite covers progression playback frames).
- CI rebuilds linux baselines.

**Manual smoke (in implementation verification):**

1. Light mode, CAGED, C major: confirm CAGED-E and CAGED-A polygons read as visibly different blues; CAGED-D polygon reads as warm taupe, visible against cream.
2. Light mode, load any progression, press Play: confirm hold glow (cyan teal) and anticipation glow (orange rust) are visible on the relevant notes during the last beat of each step.
3. Light mode, no progression (Tones-fallback path), set up a chord with guide tones in scope: confirm guide-tone notes paint the hold-glow.
4. Light mode, 3NPS fingering, C major + chord C with a 4-note voicing covering strings 1-4: confirm every C/E/G inside the active 3NPS shape gets chord-tone styling, not just the four on the voicing connector path.
5. Light mode, hover over each progression degree button (in the Progression card chord row) and each chord-navigator button: hover background is `--chrome-hover-bg` (warm taupe `#ddd8cf`), not white.
6. Dark mode regression: switch to dark, repeat #1–#5; expect no visible change other than the in-shape 3NPS fix (which applies in both modes).

---

## §6 — Sequencing and rollout

Single PR. Conventional commit types per fix surface:

- `fix(theme): rebalance light-mode CAGED palette (E/A/D)` — issue 1.
- `fix(fretboard): wire lens-emphasis glow to tokens; drop dead lens gate` — issue 2 (CSS + TS in one commit).
- `fix(fretboard): highlight in-shape chord tones in 3NPS` — issue 3.
- `fix(theme): route degree-button hover through --chrome-hover-bg` — issue 4.
- `test(visual): refresh darwin baselines for light-mode polish round 2` — issue 5.

Patch bump only — `fix:` commits drive a patch version bump via the Auto Release workflow. No `BREAKING CHANGE` footer required.

The five commits can land as one PR or two (1+4 styling, 2+3 fretboard behavior, 5 trailing). Either is fine — the user's preference goes in the implementation plan.

---

## §7 — Open questions / decisions deferred to impl

- **CAGED-D fallback.** If `#6b5d4f` taupe reads as the same band as `--text-muted: #857c6c` on the same surface, fall back to olive `#6b7c4f`. Decision: visual review during impl.
- **Issue 3 root cause.** The diagnosis steps in §3 will identify whether `isChordInRange` or `isInActiveShape` is the offending gate; the corresponding fix follows from the diagnosis. Spec commits to the behavioral target, not the gate-edit shape.
- **Issue 4 file list.** Component CSS modules holding the `#ffffff` hover are discovered by grep at impl time; the plan grows once located.
- **Glow visibility tuning.** If light-mode glow filter at current `stdDeviation` reads too subtly after the gate is removed, implementer tunes the SVG `<filter>` defs in `FretboardSVG.tsx`. Not required up-front.

---

## §8 — Related history

- v2.0 shell restructure: `dfbf3277 feat(v2.0)!: shell restructure + voicing overhaul + chord input redesign (#451)`.
- Lens Consolidation: `a7b30e23 feat(lens): Phase 4 — Tones + Lead lens redesign (#446)`.
- CAGED-E recolor: covered by note-color-audit work and theming pass token application.
- Theming pass (round 1): `docs/superpowers/specs/2026-05-27-theming-design.md` — this round-2 spec inherits and refines the round-1 token surface; the round-1 spec is kept as historical context for now and may be archived after this round lands.
