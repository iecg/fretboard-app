# Header Icon Button Consistency

**Date:** 2026-06-01

## Problem

The header icon buttons (theme toggle, settings, mute, help) use `surface--chrome` — an elevated surface with card shadow, gradient background, and lift-on-hover. All other interactive controls (ToggleBar, Stepper, NoteGrid, LabeledSelect) use the `--dc-*` flat ghost token system with cyan/teal accent colors. This makes the header buttons visually inconsistent with the rest of the app in both light and dark mode.

## Design

Swap `.icon-button` from `surface--chrome` to `surface--control` (the `--dc-*` token system used by every other control).

### Changes to .icon-button (`shared.module.css`)

| Property | Before | After |
|---|---|---|
| Surface compose | `surface--chrome` | `surface--control` |
| Background | `--surface-control` (well) | `--dc-bg` (cyan ghost) |
| Border | `--surface-control-border` | `--dc-border` |
| Text/icon color | `--surface-control-fg-muted` | `--dc-fg` |
| Box-shadow | `var(--elevation-card)` | none (flat) |
| Transition | `var(--transition-surface)` | `var(--dc-transition)` |
| Hover bg | `--surface-control-hover-bg` + gradient | `--dc-bg-hover` |
| Hover text | `--surface-control-hover-fg` | `--dc-fg-strong` |
| Hover border | `--surface-control-hover-border` | `--dc-border-hover` |
| Hover transform | `translateY(-1px)` | none |
| Active transform | `translateY(0)` | `scale(0.96)` |

### What stays the same

- Circular shape (`border-radius: 999px`)
- Size variants (`--sm`: 32px, `--md`: 44px)
- Layout properties (flex, padding, cursor, flex-shrink)
- Focus-visible ring
- Icon color inheritance via `color: inherit`

### Token resolution by theme

**Dark mode:**
- Rest: `rgb(77 228 255 / 0.05)` bg, `rgb(77 228 255 / 0.28)` border, muted cyan icon
- Hover: `rgb(77 228 255 / 0.08)` bg, `rgb(77 228 255 / 0.45)` border, bright cyan icon
- Active: `scale(0.96)`

**Light mode:**
- Rest: `rgb(20 112 136 / 0.06)` bg, `rgb(20 112 136 / 0.32)` border, muted brown icon
- Hover: `rgb(20 112 136 / 0.08)` bg, `rgb(20 112 136 / 0.50)` border, strong teal icon
- Active: `scale(0.96)`

### Files to modify

- `src/components/shared/shared.module.css` — `.icon-button` and `.icon-button:hover` rules
- Potentially `.icon-muted` / `.icon-active` icon classes if they need updated token references

### Files to *not* modify

- `App.tsx` — button markup stays the same
- `semantic.css` / `tokens.css` — no token changes needed
- `SettingsOverlay.tsx`, `HelpModal.tsx` — they use `.icon-button` too, will inherit fixes
