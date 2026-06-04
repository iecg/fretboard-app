# Fretboard marker APCA audit (`--fb-*` overlay tokens)

Date: 2026-06-03

## What this is

An **informational** APCA-W3 (Lc) contrast audit of the eight `--fb-*` overlay
marker tokens migrated to `oklch(L C H)` literals in `src/styles/themes.css`.

It has **two parts**:

1. **Fill-vs-wood (informational, NO pass/fail gate — this document).** Does each
   marker disc's solid fill stand out from the fretboard wood by a text-tier
   margin? Recorded here for reference only.
2. **Glyph-on-fill (a REAL gate — enforced in
   `src/styles/__tests__/fbColorTokens.test.ts`).** The note-number glyph is
   genuine text sitting on the solid marker fill, so a text-tier APCA threshold
   (`|Lc| ≥ 45`) legitimately applies. See that test for the live assertions.

### Why fill-vs-wood is NOT gated

The marker **discs are not text.** A filled marker is a bold shape with a
contrasting **stroke** (`--fb-*-stroke`) that defines its edge against the wood
independent of fill luminance. Text-tier APCA thresholds (designed for ~14px
bold glyphs) are the wrong instrument for "does this disc read as a marker on
the fretboard." The clearest example: the dark-theme **neutral fill** `#1b232c`
scores ≈0 |Lc| against near-black rosewood (`#160d07`/`#0d0805`/`#080403`) — yet
the marker is plainly visible because its `--fb-neutral-stroke` `#9aa3ab` ring
provides the edge. **The neutral marker reads via its stroke, not its fill
luminance.** Gating the fill at `|Lc| ≥ 45` would force every light/cream/blue
fill to invert into a dark color (and every dark fill to go light), destroying
the approved marker identities, for no legibility benefit the stroke does not
already provide.

The real, enforced text concern is the **glyph-on-fill** gate (part 2).

## Fill-vs-wood |Lc| table (informational)

Wood stops:
- Light maple: top `#fbe6c6`, mid `#f1c38e`, bottom `#e0ab68`.
- Dark rosewood: top `#160d07`, mid `#0d0805`, bottom `#080403`.

`|Lc|` is the absolute APCA-W3 lightness contrast of the resolved fill color
against each wood stop.

| Theme | Token | Resolved fill | wood-top | wood-mid | wood-bottom |
|---|---|---|---:|---:|---:|
| modern-light | `--fb-home-fill` | `#b5670a` | 55.9 | 39.1 | 27.0 |
| modern-light | `--fb-guide-fill` | `#cfeefb` | 1.9 | 17.0 | 30.2 |
| modern-light | `--fb-neutral-fill` | `#e3ddd8` | 3.8 | 10.1 | 23.3 |
| modern-dark | `--fb-home-fill` | `#b5670a` | 32.1 | 32.4 | 32.5 |
| modern-dark | `--fb-guide-fill` | `#1f5876` | 15.1 | 15.4 | 15.5 |
| modern-dark | `--fb-neutral-fill` | `#1b232c` | 0.2 | 0.5 | 0.6 |

These low numbers are **expected and acceptable** — see "Why fill-vs-wood is NOT
gated" above. In particular, dark-theme `--fb-neutral-fill` (`#1b232c`, ≈0 |Lc|
on all three rosewood stops) reads via its `--fb-neutral-stroke` `#9aa3ab` ring,
not its fill luminance.
