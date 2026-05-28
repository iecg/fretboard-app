# Theming Pass — Design

**Status:** Scope and methodology approved. Specific color values **deferred** to implementation time when the user-provided light-mode reference image is available; values are picked via the `frontend-design` skill against the reference.

**Goal:** Comprehensive review and re-tune of the fretboard note-color palette in both light and dark modes, with the light-mode treatment driven by an external reference design. Token-only refactor where possible — minimal-to-zero structural code changes.

**In scope:** items 3 and 8 from the 2026-05-27 grab-bag brainstorm (bundled per your direction).

**Out of scope:** changes to which tokens exist; component restructure; new role classifications. The taxonomy in `src/styles/semantic.css` stays as-is — this spec re-tunes values, not structure.

---

## Reference design — received 2026-05-27

User provided the light-mode reference (image attached to chat). Core palette transcribed below; image should be saved to `docs/superpowers/specs/assets/2026-05-27-theming-reference.png` by the user (or by frontend-design at the start of execution) so the spec links to a durable file.

### Palette

| Reference name | Hex | Role in reference |
|---|---|---|
| BG | `#ebebdc` | App background — warm parchment |
| PANEL | `#f6f2e9` | Card/panel surface — cream |
| PANEL-SOFT | `#e3ddd8` | Secondary surface — warm beige |
| INK | `#2a251d` | Primary text — dark warm brown (no black) |
| MUTE | `#857c6c` | Secondary text — warm gray |
| CYAN | `#147088` | Primary accent — deep teal (logo, active states, toggles, tab underline, active shape button fill) |
| ORANGE | `#b1431b` | Warm accent — rust/terracotta (active chord card tint, plausibly playback / chord-tone ring) |

Fretboard wood color visible in reference (no swatch label): warm tan, roughly `#d6c4a0` family — more saturated than PANEL, less than the existing maple. Frontend-design should sample the exact value from the reference image.

### Aesthetic direction

Vintage/editorial. Warm earthy base, no pure white or pure black, complementary teal+rust accents. The light mode shifts from "wood-grained guitar app" toward "artisan tool / fine notebook". Implications:

- The current `[data-theme="modern-light"]` cool-blue string retone is replaced by a warm string treatment in the same palette family as INK/MUTE.
- "Active" everywhere collapses to one accent: CYAN. Used for tab underline, active toggle track, active shape button fill, links, primary CTA.
- "Playback / active chord" everywhere collapses to: ORANGE. Used for the active chord card tint, plausibly for chord-tone ring + the anticipation glow token added by Lens Consolidation.
- Tonic / scale-root might also adopt ORANGE as the warm "this is special" marker (current light-mode `--note-ring-tonic: #b45309` is in the same family — natural fit).

### Suggested token-family mappings (frontend-design verifies/iterates)

These are not commitments; they're a starting point for `frontend-design` to evaluate against the reference image.

- **Family 1 — Note fills (light mode):**
  - `--fretboard-note-fill-tonic` → derived from ORANGE at high lightness (e.g. `color-mix` rust + cream).
  - `--fretboard-note-fill-chord-root` → ORANGE-tinted cream, slightly stronger than tonic.
  - `--fretboard-note-fill-chord-tone` → CYAN-tinted cream.
  - `--fretboard-note-fill-scale-only` → PANEL-SOFT or a wood-tinted neutral.
  - `--fretboard-note-fill-chord-outside`, `-tension-emph`, `-tension-strong` → ORANGE-family at varying intensities.
  - `--fretboard-note-fill-guide-emph` → CYAN-family.
- **Family 2 — Note rings + glows (light mode):**
  - `--note-ring` → CYAN (`#147088`).
  - `--note-ring-tonic` → ORANGE (`#b1431b`).
  - `--note-ring-color-tone` → a third earthy hue (consider MUTE `#857c6c` or a desaturated rust).
- **Family 4 — Lens-emphasis glows (NEW tokens):**
  - `--note-glow-anticipation` light → ORANGE-family. Dark → keep existing orange `#fb923c`-ish or retune.
  - `--note-glow-hold` light → CYAN-family. Dark → keep existing cyan `#06b6d4`-ish or retune.
- **Panel / chrome:**
  - `--surface-app` → BG (`#ebebdc`).
  - `--surface-card` → PANEL (`#f6f2e9`).
  - `--surface-card-soft` → PANEL-SOFT (`#e3ddd8`).
  - `--text-primary` → INK (`#2a251d`).
  - `--text-muted` → MUTE (`#857c6c`).
  - `--accent-primary` → CYAN.
  - `--accent-warm` → ORANGE.

Token NAMES above are illustrative — frontend-design works against whatever the current codebase actually defines (see file-touch list below).

---

## Context

### Today

**Light mode** (`[data-theme="modern-light"]` block in `src/styles/themes.css`): warm maple wood background with retoned cool-blue strings; note tokens override the `:root` defaults case-by-case. Currently the user reports the note treatment doesn't feel cohesive against the maple background — the reference design they will provide is the corrective.

**Dark mode** (`:root` defaults in `src/styles/semantic.css`, with the optional `[data-theme="modern-dark"]` override block): warm rosewood background with mirror-warm-amber palette. Note tokens use neon-cyan/neon-orange/neon-violet for various roles.

**Cross-cutting constraints inherited from other 2026-05-27 specs:**

- **From Lens Consolidation (group B):** the always-on emphasis stack now collapses two lenses' visual signals into one. The current Lead-lens "anticipation glow" uses `orange`, which collides with chord-tone-ring orange and (pre-CAGED-E-recolor) the CAGED-E shape's orange. After the CAGED-E recolor lands, the chord-tone-ring orange remains. **The theming pass must pick a new anticipation glow color that doesn't collide with chord-tone-ring.**
- **From Lens Consolidation:** the Lead "hold" glow (`cyan`) and the guide-tone fallback glow (`cyan`) overlap. With the consolidated emphasis stack, hold is the dominant case — **cyan should be visually unambiguous, possibly differentiated from guide-tone fallback to avoid double-meaning**.
- **From Lens Consolidation:** the radius/opacity values (`1.15×`, `1.2×`, `0.85×`, `0.6× opacity`) were tuned for the two-lens system. **They likely need re-tune for the always-on stack** — flagged for the implementer to verify visually rather than re-spec.
- **From CAGED-E Recolor (item 2):** if the chord-connector palette is rebalanced as part of this pass, the CAGED-E-sky-blue / connector-slot-5-sky-blue collision can be revisited here. Optional, not required.

### Why a scope + methodology spec (no values)

User intent: provide the reference design at implementation time; use `frontend-design` skill to pick values against it. Locking in hex values now would either be wrong (no reference to match) or duplicate effort (re-spec when reference arrives). The actionable spec is the **token surface and the constraints** the values must satisfy.

---

## Design — token surface

The theming pass touches one logical surface (fretboard note rendering) split across several token families. Implementation re-tunes values; the token names and code-side bindings stay unchanged.

### Family 1 — Fretboard note fills (semantic.css lines 191–198, themes.css overrides)

Per-role fill colors for fretboard notes:

```
--fretboard-note-fill-tonic
--fretboard-note-fill-chord-root
--fretboard-note-fill-chord-tone
--fretboard-note-fill-scale-only
--fretboard-note-fill-chord-outside
--fretboard-note-fill-tension-emph
--fretboard-note-fill-tension-strong
--fretboard-note-fill-guide-emph
```

Each has a `:root` default (dark mode) and an override in `[data-theme="modern-light"]`. Light-mode overrides are the primary target of this spec; dark-mode values may also be retuned per the reference if the user wants cross-mode consistency.

### Family 2 — Note rings + glows (semantic.css lines 132–141)

```
--note-ring
--note-ring-tonic
--note-ring-dim
--note-ring-color-tone
--note-glow
--note-glow-tonic
```

Used by FretboardNoteLayer for the colored ring + glow around each note. Currently rebound in light mode in themes.css (`--note-ring: #0369a1` etc.).

### Family 3 — Note text colors (semantic.css lines 138–139, 177–179)

```
--note-text-in-scale
--note-text-tonic
--note-label-on-color
--note-label-on-color-stroke
--note-label-on-color-shadow
```

WCAG contrast against the family-1 fill colors is the constraint here.

### Family 4 — Lens-emphasis glow colors (consumed in src/components/FretboardSVG/utils/semantics.ts)

After Lens Consolidation lands, two glow colors remain in `getEmphasis` (formerly `getLensEmphasis`):

- **Anticipation glow** — currently hardcoded `glowColor: "orange"`. Must move to a CSS-token reference (e.g. `var(--note-glow-anticipation)`) and pick a new color that doesn't collide with chord-tone-ring orange. **New token to add: `--note-glow-anticipation`** (one of the only structural changes in this spec).
- **Hold / guide-tone glow** — currently hardcoded `glowColor: "cyan"`. Move to `var(--note-glow-hold)` and either keep cyan (if disambiguation isn't visually critical) or differentiate. **New token to add: `--note-glow-hold`**.

These are the only NEW tokens the spec adds — driven by Lens Consolidation's carry-over requirement. Both have light + dark values.

### Family 5 — Scale-degree colors (uiAtoms / degree color tokens)

```
--degree-color (per-degree fills, dynamically set)
```

Plus per-degree base hues. Light-mode contrast and dark-mode vibrancy are both candidates for re-tune. Out of scope if the reference design doesn't address them — flagged for the implementer to ask before changing.

### Family 6 — CAGED palette (only if rebalance is needed)

`--caged-c/-a/-g/-e/-d` and their `-fg/-bg` variants. Item 2's standalone CAGED-E recolor handles E. This spec only re-touches the palette if the reference design implies a rebalance — otherwise leave alone (each CAGED shape's color identity is intentional).

---

## Methodology

### Step 1 — Reference intake

User provides the reference design (image, Figma file, or other). The implementer reads the reference and identifies:

- Background tonality (warmer/cooler than current maple)
- Note treatment (filled/outlined, soft/saturated, etc.)
- Per-role visual hierarchy (which roles are loudest, which are subdued)
- Any specific color choices the reference makes for tonic, chord root, scale-only, etc.

### Step 2 — Frontend-design execution

Invoke `frontend-design` skill with:
- The reference image as the visual target
- This spec's token surface as the scope ("here are the tokens to update; no structural code changes")
- Lens Consolidation carry-over constraints (must add `--note-glow-anticipation` + `--note-glow-hold` tokens; no orange collision; cyan disambiguation if visually required)
- CAGED-E recolor as inherited state (E is sky blue)

Frontend-design proposes specific values, presents to user, iterates until approved.

### Step 3 — Cross-mode verification

For each token retuned in light mode, decide whether dark mode also needs retune. If reference design implies a cohesive cross-mode palette, retune both. If reference is light-mode-only and dark mode currently works, leave dark alone (smaller blast radius).

### Step 4 — WCAG contrast pass

For every fill ↔ text pair retuned, verify ≥4.5:1 contrast ratio (3:1 acceptable for large/decorative text). Document any deliberate exceptions in a code comment near the token.

### Step 5 — Visual regression refresh

`pnpm run test:visual:update` after token swaps. Expect updates across `e2e/app-components/fretboard-svg-*`, any chord-overlay snapshots, both light + dark mode variants if both were retuned.

### Step 6 — Manual smoke

- Both modes, every fingering pattern (CAGED, 3NPS, 1-string, 2-strings), with and without an active chord overlay.
- Lens emphasis stack: load a 4-bar progression at 120 BPM, press Play, verify anticipation glow is visually distinct from chord-tone-ring orange.
- Per-degree color enablement: toggle degree colors on/off, verify the new palette reads cleanly in both modes.

---

## Tests

- **No new atom contracts.** This spec touches CSS tokens; no JS state changes.
- **Existing unit tests stay green.** Token-name bindings don't change (except the two new lens-emphasis tokens).
- **`getEmphasis` (post-Lens-Consolidation):** update test to assert `glowColor: "var(--note-glow-anticipation)"` instead of literal `"orange"`, and `var(--note-glow-hold)` instead of `"cyan"`.
- **Visual baselines:** full refresh after implementation (see Methodology Step 5).
- **WCAG contrast:** if a contrast-testing utility lives in the codebase, run it as part of the verification; otherwise document the manual pass in the implementation plan.

---

## Files to touch

**Modify (token-only):**
- `src/styles/themes.css` — `[data-theme="modern-light"]` block re-tune for the token families listed above; possibly `[data-theme="modern-dark"]` block for cross-mode consistency.
- `src/styles/semantic.css` — add `--note-glow-anticipation` + `--note-glow-hold` defaults (dark mode); possibly retune existing tokens if the reference design implies dark-mode change.
- `src/styles/index.css` — re-tune `--note-blue` / `--note-blue-glow` and the dark-mode `--caged-*` defaults only if reference design requires.

**Modify (small code change):**
- `src/components/FretboardSVG/utils/semantics.ts` — swap hardcoded `"orange"` / `"cyan"` in `getEmphasis` (post-Lens-Consolidation) for `var(--note-glow-anticipation)` / `var(--note-glow-hold)`.

**Modify (test update):**
- The `getEmphasis` unit test (path TBD post-Lens-Consolidation rename) to match the token references.

**No new files. No deletes.**

**Visual baselines:** full refresh of fretboard + chord-overlay snapshots, both modes.

---

## Sequencing

This spec sits **downstream** of:

1. **Lens Consolidation** (group B) — needed because this spec adds glow-color tokens that Lens Consolidation surfaces and renames `getLensEmphasis` → `getEmphasis`.
2. **CAGED-E Recolor** (item 2) — needed because CAGED-E's new sky blue is the inherited state this spec consumes; the chord-connector palette rebalance (optional in this spec) only makes sense once E is no longer orange.
3. **User-provided reference design** — the actual color decisions can't be made without it. This is the hard gate.

It can ship **before or after** the Chord Voicings Card UX spec (group A); A doesn't touch token values.

If the onboarding tutorial (item 7) ships before theming, its welcome-modal illustrations will need refresh after theming lands.
