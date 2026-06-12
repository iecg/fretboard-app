# Design Rationale — Durable "Why" Docs

These docs hold the **durable research and rationale** behind FretFlow's design. They
live here (not in `docs/superpowers/`) so they survive the pruning of ephemeral specs
and plans. **Read on demand** — they are not preloaded into agent context. When a new
spec makes a decision in one of these domains, it should *cite* the relevant doc rather
than re-deriving the grounding, and add any new sources back into it.

| Doc | Consult before changing… |
|---|---|
| [`fretboard-visual-language.md`](./fretboard-visual-language.md) | markers, color, marker shape/size/fill, connectors, voice-leading motion, contrast/OKLCH tokens — *how notes are drawn* |
| [`audio-voicing-engine.md`](./audio-voicing-engine.md) | voicing selection, inversion-based strum, close-voicing fallback, audio / Tone.js playback |
| [`music-theory-pedagogy.md`](./music-theory-pedagogy.md) | chord qualities & extensions, scales, guide tones, improvisation lenses, modal characteristic tones — *what notes mean* |
| [`mobile-ui-contract.md`](./mobile-ui-contract.md) | mobile/tablet sheet shell, panels/drawers, Settings/Help sheets, surfaces & dividers, header padding, scroll/overflow, zoom control — *enforceable UI rules* (run `/ui-review` or `pnpm run ui:tokens`) |

**Domain split.** Theory (`music-theory-pedagogy.md`) decides which notes mean what;
visual-language (`fretboard-visual-language.md`) decides how they look; audio-voicing
(`audio-voicing-engine.md`) decides which notes sound and how. The three cross-reference
each other but do not duplicate.

**Provenance model.** Each doc's §Provenance lists the source specs it consolidates with
the git SHA from just before deletion. Recover an original spec with
`git show <sha>:<path>`. The ephemeral specs and plans these docs replaced were pruned in
the 2026-06-08 docs cleanup and are recoverable from git history.
