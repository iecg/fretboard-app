# Replay TopBandSummary Consolidation on Top of Main

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rebased branch with a clean reapply of the TopBandSummary consolidation on top of `origin/main`, preserving every fix from `#363` and bumping the unified card's `border-radius` to match main's visual scale.

**Architecture:** Hard-reset `feat/unified-top-band-shell` to `origin/main`, then reapply the consolidation as a small set of curated commits. Each commit extracts the final desired file content from the `pre-rebase/feat-unified-top-band-shell` reference tag (which holds the rebased branch HEAD), so we get the *final* state of every change rather than re-living conflict resolutions. The one deliberate edit on top of the tag's content: change `TopBandSummary.module.css`'s card `border-radius` from `var(--radius-md)` (0.5rem) to `var(--radius-card)` (1rem) to align with main's card scale.

**Tech Stack:** Git, CSS Modules, React 19, motion/react, lucide-react, Vitest, Playwright.

**Source of truth for final file content:** tag `pre-rebase/feat-unified-top-band-shell` (commit `9b8d9e8` — the local branch HEAD after the last pre-rebase commit; we additionally rebased on top of `origin/main` after that, but the source files there are equivalent for the purposes of this plan). Where the plan says "extract from the reference," use `git show feat/unified-top-band-shell@{1}:<path>` if `pre-rebase/...` is empty, or use the reflog. Concretely, run once at the start:

```bash
REFERENCE_SHA=$(git rev-parse feat/unified-top-band-shell)
echo "Reference SHA: $REFERENCE_SHA"
```

then use `git show "$REFERENCE_SHA":<path>` throughout.

---

## File Map

| File | Source | Notes |
|---|---|---|
| `src/components/shared/shared.module.css` | reference | Adds `.card-section-header` |
| `src/components/TopBandSummary/TopBandSummary.tsx` | reference (verbatim) | New component |
| `src/components/TopBandSummary/TopBandSummary.module.css` | reference + 1 edit | Change card `border-radius` token |
| `src/components/DegreeChipStrip/DegreeChipStrip.tsx` | reference (verbatim) | Animate list + compose header |
| `src/components/DegreeChipStrip/DegreeChipStrip.module.css` | reference (verbatim) | Compose shared header |
| `src/components/ChordPracticeBar/ChordPracticeBar.tsx` | reference (verbatim) | Lucide + animate + compose + aria-pressed fix |
| `src/components/ChordPracticeBar/ChordPracticeBar.module.css` | reference (verbatim) | Compose shared header |
| `src/components/ChordPracticeBar/ChordPracticeBar.test.tsx` | reference (verbatim) | Updated lucide selectors + aria-pressed |
| `src/test-utils/setup.ts` | reference (verbatim) | Adds MotionConfig to motion/react mock |
| `src/App.tsx` | reference (verbatim) | Swap to TopBandSummary |
| `src/App.test.tsx` | reference (verbatim) | Query the new structure |
| `src/components/MainLayoutWrapper/MainLayoutWrapper.tsx` | reference (verbatim) | Drop chordDock prop |
| `src/components/MainLayoutWrapper/MainLayoutWrapper.module.css` | reference (verbatim) | Drop top-band-shell & chord-dock-shell |
| `src/components/ChordOverlayDock/ChordOverlayDock.test.tsx` | reference (verbatim) | Now tests TopBandSummary |
| `src/cssGlobals.test.ts` | reference (verbatim) | Update class allowlist |
| `e2e/**/*-chromium-darwin.png` (regenerated) | regenerated | After all source applies |

---

## Task 1: Back up and reset the branch

**Files:** none (git state only).

- [ ] **Step 1: Capture the reference SHA and lock it as a tag**

Run:
```bash
git rev-parse HEAD
git tag rebased-reference/feat-unified-top-band-shell HEAD
```

Expected: tag created. The SHA echoed should be `b203e93` (the test(visual) commit on the rebased branch) or whatever the current branch HEAD is.

- [ ] **Step 2: Verify clean working tree**

Run: `git status --short`
Expected: empty output (clean).

- [ ] **Step 3: Reset the branch to origin/main**

Run:
```bash
git fetch origin main
git reset --hard origin/main
git log --oneline -1
```

Expected: HEAD is at `5f45fd8 refactor: codebase improvements across 12 phases (#363)` (or whatever `origin/main` currently points at).

- [ ] **Step 4: Confirm the reference tag still resolves**

Run: `git rev-parse rebased-reference/feat-unified-top-band-shell`
Expected: prints a valid SHA (the rebased state preserved).

- [ ] **Step 5: Export the reference SHA for later steps**

Run:
```bash
git show rebased-reference/feat-unified-top-band-shell -- src/components/TopBandSummary/TopBandSummary.module.css | head -5
```

Expected: shows the diff of the TopBandSummary CSS file relative to its parent in the tag — confirms `git show <tag>:<path>` will work.

No commit in this task.

---

## Task 2: Add shared `.card-section-header` class

**Files:**
- Modify: `src/components/shared/shared.module.css`

- [ ] **Step 1: Extract the rebased state of `shared.module.css` and apply locally**

Run:
```bash
git show rebased-reference/feat-unified-top-band-shell:src/components/shared/shared.module.css > src/components/shared/shared.module.css
```

This overwrites the file in the working tree with the rebased version. `#363`'s changes to `shared.module.css` are already in the rebased state (the rebase resolved them), so this is safe.

- [ ] **Step 2: Loosen the shared `.card-section-header` to match main's header rhythm**

The reference version uses `gap: 0.4rem` and `line-height: 1.15`. Main's `.chord-practice-bar-header` uses `gap: 0.45rem` and inherits `line-height: 1.2` from the title. Bring the shared rule into alignment.

Use Edit on `src/components/shared/shared.module.css`. Find:
```
  gap: 0.4rem;
  width: 100%;
  font-family: var(--font-sans);
  font-size: var(--strip-header-size, 0.82rem);
  font-weight: var(--font-weight-medium);
  color: var(--text-main);
  line-height: 1.15;
```
Replace with:
```
  gap: 0.45rem;
  width: 100%;
  font-family: var(--font-sans);
  font-size: var(--strip-header-size, clamp(0.92rem, 1.5vw, 1.05rem));
  font-weight: var(--font-weight-medium);
  color: var(--text-main);
  line-height: 1.2;
```

Three changes: `gap` 0.4rem → 0.45rem, `font-size` fallback `0.82rem` → `clamp(0.92rem, 1.5vw, 1.05rem)`, and `line-height` 1.15 → 1.2. All three match main's pre-consolidation header rhythm so a consumer that *doesn't* cascade `--strip-header-size` (no nested card override) reads visually identical to main's old separate headers.

Verify with `grep -n "card-section-header" -A 14 src/components/shared/shared.module.css` — should show the new values.

- [ ] **Step 3: Verify lint and CSS is clean**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/shared.module.css
git commit -m "feat(top-band): add shared card-section-header class"
```

---

## Task 3: Create TopBandSummary component (with `--radius-card` border-radius)

**Files:**
- Create: `src/components/TopBandSummary/TopBandSummary.tsx`
- Create: `src/components/TopBandSummary/TopBandSummary.module.css`

- [ ] **Step 1: Create the folder**

Run: `mkdir -p src/components/TopBandSummary`

- [ ] **Step 2: Extract the TSX file from the reference**

Run:
```bash
git show rebased-reference/feat-unified-top-band-shell:src/components/TopBandSummary/TopBandSummary.tsx > src/components/TopBandSummary/TopBandSummary.tsx
```

- [ ] **Step 3: Extract the CSS file from the reference**

Run:
```bash
git show rebased-reference/feat-unified-top-band-shell:src/components/TopBandSummary/TopBandSummary.module.css > src/components/TopBandSummary/TopBandSummary.module.css
```

- [ ] **Step 4: Fix the card border-radius — change `--radius-md` to `--radius-card`**

The reference state uses `border-radius: var(--radius-md);` which renders as 0.5rem. Main's separate cards rendered at ~1rem. The `--radius-card` token (1rem) already exists in `tokens.css` for exactly this case.

Use Edit on `src/components/TopBandSummary/TopBandSummary.module.css`. Find:
```
  border-radius: var(--radius-md);
```
Replace with:
```
  border-radius: var(--radius-card);
```

Verify with: `grep -n "border-radius" src/components/TopBandSummary/TopBandSummary.module.css`
Expected: shows `border-radius: var(--radius-card);` near the top of `.top-band-summary`.

- [ ] **Step 5: Loosen the cascaded `--strip-header-size` so child headers match main**

The reference cascades `--strip-header-size: 0.82rem` down to the chip strip and chord bar headers via the `.top-band-summary` block. With Task 2's loosening of `.card-section-header`, the *fallback* (no override) already matches main. But the cascade here still pins it to 0.82rem, which renders too tight.

Use Edit on `src/components/TopBandSummary/TopBandSummary.module.css`. Find:
```
  --strip-header-size: 0.82rem;
```
Replace with:
```
  --strip-header-size: clamp(0.92rem, 1.5vw, 1.05rem);
```

This restores main's clamp range for the unified card's section headers. The card is still visually denser than two separate cards (single card chrome, suppressed child surfaces, tighter `--strip-padding`), so we don't need an extra-compact header on top of that.

Verify with: `grep -n "strip-header-size" src/components/TopBandSummary/TopBandSummary.module.css`
Expected: shows the clamp value, not 0.82rem.

- [ ] **Step 6: Verify lint**

Run: `npm run lint`
Expected: PASS.

(Note: at this point the new component isn't imported anywhere, so it won't affect tests yet. That happens in Task 7.)

- [ ] **Step 7: Commit**

```bash
git add src/components/TopBandSummary/TopBandSummary.tsx \
        src/components/TopBandSummary/TopBandSummary.module.css
git commit -m "$(cat <<'EOF'
feat(top-band): add TopBandSummary unified card component

A new component that wraps DegreeChipStrip and (conditionally)
ChordPracticeBar in a single card surface. Owns the card chrome,
suppresses child strip surfaces via CSS custom-property overrides,
animates the chord section mount/unmount with motion/react, and
renders an inset hairline divider between the two regions.

Uses --radius-card (1rem) to match main's card scale rather than
--radius-md (0.5rem), which would render too tight relative to the
content density. The cascaded --strip-header-size matches main's
clamp range (clamp(0.92rem, 1.5vw, 1.05rem)) so the chip strip and
chord bar headers read at the same scale as before consolidation.

Wraps the entire returned tree in <MotionConfig reducedMotion="user">
so users with prefers-reduced-motion get instant transitions.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Update DegreeChipStrip (animated list + composed header)

**Files:**
- Modify: `src/components/DegreeChipStrip/DegreeChipStrip.tsx`
- Modify: `src/components/DegreeChipStrip/DegreeChipStrip.module.css`

- [ ] **Step 1: Extract both files from the reference**

```bash
git show rebased-reference/feat-unified-top-band-shell:src/components/DegreeChipStrip/DegreeChipStrip.tsx > src/components/DegreeChipStrip/DegreeChipStrip.tsx
git show rebased-reference/feat-unified-top-band-shell:src/components/DegreeChipStrip/DegreeChipStrip.module.css > src/components/DegreeChipStrip/DegreeChipStrip.module.css
```

- [ ] **Step 2: Verify the changes landed**

```bash
grep -n "AnimatePresence\|motion.ul\|card-section-header" src/components/DegreeChipStrip/DegreeChipStrip.tsx src/components/DegreeChipStrip/DegreeChipStrip.module.css
```
Expected: shows `AnimatePresence` import, `motion.ul` element, `composes: card-section-header` line, and the `.scale-eye-toggle` local override rules from `#363`.

- [ ] **Step 3: Run the DegreeChipStrip tests**

Run: `npm run test -- src/components/DegreeChipStrip/DegreeChipStrip.test.tsx`
Expected: PASS (30/30).

- [ ] **Step 4: Commit**

```bash
git add src/components/DegreeChipStrip/DegreeChipStrip.tsx \
        src/components/DegreeChipStrip/DegreeChipStrip.module.css
git commit -m "feat(degree-chip-strip): animate chip list collapse + compose shared header"
```

---

## Task 5: Update ChordPracticeBar (lucide + animate + composed header + aria-pressed alignment)

**Files:**
- Modify: `src/components/ChordPracticeBar/ChordPracticeBar.tsx`
- Modify: `src/components/ChordPracticeBar/ChordPracticeBar.module.css`
- Modify: `src/components/ChordPracticeBar/ChordPracticeBar.test.tsx`

- [ ] **Step 1: Extract all three files from the reference**

```bash
git show rebased-reference/feat-unified-top-band-shell:src/components/ChordPracticeBar/ChordPracticeBar.tsx > src/components/ChordPracticeBar/ChordPracticeBar.tsx
git show rebased-reference/feat-unified-top-band-shell:src/components/ChordPracticeBar/ChordPracticeBar.module.css > src/components/ChordPracticeBar/ChordPracticeBar.module.css
git show rebased-reference/feat-unified-top-band-shell:src/components/ChordPracticeBar/ChordPracticeBar.test.tsx > src/components/ChordPracticeBar/ChordPracticeBar.test.tsx
```

- [ ] **Step 2: Verify**

```bash
grep -n "lucide-react\|AnimatePresence\|motion.div\|card-section-header" src/components/ChordPracticeBar/ChordPracticeBar.tsx src/components/ChordPracticeBar/ChordPracticeBar.module.css
grep -n "aria-pressed={collapsed}" src/components/ChordPracticeBar/ChordPracticeBar.tsx
grep -n "lucide-eye\|lucide-eye-off" src/components/ChordPracticeBar/ChordPracticeBar.test.tsx
```
Expected: lucide import, AnimatePresence + motion.div wrappers, `composes: card-section-header`, the corrected `aria-pressed={collapsed}` line, and test selectors using `.lucide-eye` / `.lucide-eye-off`.

- [ ] **Step 3: Run ChordPracticeBar tests**

Run: `npm run test -- src/components/ChordPracticeBar/ChordPracticeBar.test.tsx`
Expected: PASS (40/40).

- [ ] **Step 4: Commit**

```bash
git add src/components/ChordPracticeBar/ChordPracticeBar.tsx \
        src/components/ChordPracticeBar/ChordPracticeBar.module.css \
        src/components/ChordPracticeBar/ChordPracticeBar.test.tsx
git commit -m "$(cat <<'EOF'
feat(chord-practice-bar): lucide icons + animated groups + shared header

- Replace inline eye SVGs with lucide-react Eye / EyeOff (size 16).
- Wrap groups container in AnimatePresence + motion.div for smooth
  collapse.
- Compose card-section-header from shared so the header pattern
  matches DegreeChipStrip exactly.
- Align eye-toggle aria-pressed with the shared .eye-toggle convention:
  pressed=true means the toggle action (hide) is active, so the icon
  dims when content is hidden. Previously this was inverted relative
  to DegreeChipStrip.
- Tests query lucide's stable .lucide-eye / .lucide-eye-off classes
  instead of test-coupled data-icon attributes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Add MotionConfig to test mock

**Files:**
- Modify: `src/test-utils/setup.ts`

- [ ] **Step 1: Extract from reference**

```bash
git show rebased-reference/feat-unified-top-band-shell:src/test-utils/setup.ts > src/test-utils/setup.ts
```

- [ ] **Step 2: Verify**

Run: `grep -n "MotionConfig" src/test-utils/setup.ts`
Expected: one match showing the MotionConfig mock pass-through.

- [ ] **Step 3: Commit**

```bash
git add src/test-utils/setup.ts
git commit -m "test(setup): mock MotionConfig from motion/react"
```

---

## Task 7: Wire TopBandSummary into App and update tests

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/components/MainLayoutWrapper/MainLayoutWrapper.tsx`
- Modify: `src/components/MainLayoutWrapper/MainLayoutWrapper.module.css`
- Modify: `src/components/ChordOverlayDock/ChordOverlayDock.test.tsx`
- Modify: `src/cssGlobals.test.ts`

- [ ] **Step 1: Extract all six files from the reference**

```bash
git show rebased-reference/feat-unified-top-band-shell:src/App.tsx > src/App.tsx
git show rebased-reference/feat-unified-top-band-shell:src/App.test.tsx > src/App.test.tsx
git show rebased-reference/feat-unified-top-band-shell:src/components/MainLayoutWrapper/MainLayoutWrapper.tsx > src/components/MainLayoutWrapper/MainLayoutWrapper.tsx
git show rebased-reference/feat-unified-top-band-shell:src/components/MainLayoutWrapper/MainLayoutWrapper.module.css > src/components/MainLayoutWrapper/MainLayoutWrapper.module.css
git show rebased-reference/feat-unified-top-band-shell:src/components/ChordOverlayDock/ChordOverlayDock.test.tsx > src/components/ChordOverlayDock/ChordOverlayDock.test.tsx
git show rebased-reference/feat-unified-top-band-shell:src/cssGlobals.test.ts > src/cssGlobals.test.ts
```

- [ ] **Step 2: Verify App.tsx imports the right things and drops the old ones**

```bash
grep -n "TopBandSummary\|ScaleStripPanel\|ChordOverlayDock\|showChordPracticeBarAtom\|audioErrorAtom" src/App.tsx
```
Expected:
- `import { TopBandSummary } from "./components/TopBandSummary/TopBandSummary"` present.
- No `ScaleStripPanel` import.
- No `ChordOverlayDock` import.
- No `showChordPracticeBarAtom` reference.
- `audioErrorAtom` import present (preserved from `#363`).

- [ ] **Step 3: Verify MainLayoutWrapper drops chordDock and top-band-shell**

```bash
grep -n "chordDock\|top-band-shell\|chord-dock-shell" src/components/MainLayoutWrapper/MainLayoutWrapper.tsx src/components/MainLayoutWrapper/MainLayoutWrapper.module.css
```
Expected: no matches.

- [ ] **Step 4: Verify MainLayoutWrapper.module.css keeps `#363`'s app-shell tier overrides**

```bash
grep -n "app-shell\|--layout-gap" src/components/MainLayoutWrapper/MainLayoutWrapper.module.css
```
Expected: shows `.app-shell` rule and the layout-tier `--layout-gap` overrides preserved from `#363`.

- [ ] **Step 5: Run all touched-component tests**

Run:
```bash
npm run test -- src/App.test.tsx \
                 src/components/MainLayoutWrapper \
                 src/components/ChordOverlayDock \
                 src/components/TopBandSummary \
                 src/components/DegreeChipStrip \
                 src/components/ChordPracticeBar \
                 src/cssGlobals.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx \
        src/App.test.tsx \
        src/components/MainLayoutWrapper/MainLayoutWrapper.tsx \
        src/components/MainLayoutWrapper/MainLayoutWrapper.module.css \
        src/components/ChordOverlayDock/ChordOverlayDock.test.tsx \
        src/cssGlobals.test.ts
git commit -m "$(cat <<'EOF'
feat(layout): wire unified TopBandSummary into the app shell

- App.tsx swaps ScaleStripPanel + ChordOverlayDock for TopBandSummary.
  The showChordPracticeBarAtom subscription moves into TopBandSummary
  itself (the unified card owns its own visibility logic).
- MainLayoutWrapper drops the chordDock prop and the redundant
  top-band-shell / chord-dock-shell wrappers. The .summary-shell
  becomes the single positioning slot — TopBandSummary owns its own
  card chrome and chord-section animation. The .app-shell --layout-gap
  tier overrides added in #363 are preserved.
- Tests realign to the new structure: App.test queries the unified
  .top-band-summary surface, ChordOverlayDock.test now exercises
  TopBandSummary (the dock component is no longer rendered anywhere),
  and cssGlobals.test updates the class allowlist.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Run the full test suite and snapshot any drift

**Files:** (no source files — may regenerate gitignored component snapshots)

- [ ] **Step 1: Run the full unit suite**

Run: `npm run test`
Expected: PASS, or only snapshot diffs in `src/snapshots.test.tsx`. If snapshots fail, re-run with `-u` and then again without:
```bash
npm run test -- -u
npm run test
```
Expected: second run is clean PASS.

Component snapshots live under `src/__snapshots__/` and are gitignored — no commit needed.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: PASS. If TS errors mention missing packages, run `npm install` and retry (the `#363` merge added new deps such as `fast-check`).

---

## Task 9: Refresh visual regression snapshots

**Files:**
- Modify: `e2e/**/*-chromium-darwin.png` (binary)

The unified card renders at a new `border-radius: var(--radius-card)` (1rem) — different from anything captured before this plan. All visual snapshots that contain the top band need regenerating. The rebased reference's snapshots are stale relative to the new radius.

- [ ] **Step 1: Run the visual update**

Run: `npm run test:visual:update`
Expected: regenerates all relevant darwin snapshots. The command should complete with `passed` for every spec.

- [ ] **Step 2: Run the full visual suite to confirm**

Run: `npm run test:visual`
Expected: PASS (typically 37–39 specs).

- [ ] **Step 3: Commit refreshed snapshots**

```bash
git add e2e/
git commit -m "test(visual): refresh snapshots for replayed top-band card"
```

---

## Task 10: Final sanity check and force-push

- [ ] **Step 1: Final triple-check**

Run in parallel: `npm run lint`, `npm run test`, `npm run build`.
Expected: all PASS.

- [ ] **Step 2: Compare commit count**

Run: `git log --oneline origin/main..HEAD`
Expected: 8 commits (Tasks 2–9). Each commit message is self-contained.

- [ ] **Step 3: Force-push the rewritten branch**

The branch on origin has the pre-rebase history; we're rewriting it with the cleanly replayed sequence. Use `--force-with-lease` to refuse the push if anyone else moved the remote:

```bash
git push --force-with-lease origin feat/unified-top-band-shell
```

Expected: push succeeds.

- [ ] **Step 4: Confirm PR shows the new commits**

Run: `gh pr view 364 --json commits --jq '.commits[] | "\(.oid[0:7]) \(.messageHeadline)"'`
Expected: shows the 8 new commits in chronological order.

- [ ] **Step 5: Optional cleanup of reference tag**

Once the PR is reviewed and merged successfully, the rebased-reference tag can be deleted:

```bash
# After merge — not now
git tag -d rebased-reference/feat-unified-top-band-shell
git tag -d pre-rebase/feat-unified-top-band-shell
```

Skip this step for now; keep the tags as a safety net until merge.

---

## Notes for the implementer

- **Why the radius matters:** the old separate cards used `--strip-radius` defaults of 0.85rem (chord) and 1rem (scale). Collapsing them under a single `--radius-md: 0.5rem` made the unified card look visually sharper/tighter than every other card in the app. `--radius-card: 1rem` is the project's canonical card token — already used by other surfaces.

- **Why "extract from reference" instead of cherry-pick:** cherry-picking individual commits would replay every conflict resolution from the rebase. We already validated the final state (lint + tests + build + visual all passed in the rebased branch). Extracting the *final* content per file as a small set of logical commits gives us clean history without re-litigating conflicts.

- **Reference tag scope:** the reference is local-only (we created it on the developer's machine). Do not push the tag to origin. After this plan executes, the published history of the branch will have just the 8 clean commits.

- **If the reference tag is missing:** the equivalent SHA can be recovered from the reflog: `git reflog feat/unified-top-band-shell | grep "rebase"` or by re-running the original rebase from `pre-rebase/feat-unified-top-band-shell`. If that's also gone, the source files can be reconstructed from the GitHub PR's commits at #364.

- **`#363` improvements preserved:** the rebased reference already resolved the conflicts with `#363` correctly (kept main's `--focus-ring` token usage on `.scale-eye-toggle` and `.practice-bar-eye-toggle`, kept main's `--layout-gap` tier overrides on `.app-shell`, kept main's `audioErrorAtom` import in App.tsx). By extracting the rebased state file-by-file, we inherit all of those preservations.

- **Out of scope:** the broader spec items already shipped (lucide icons, shared header pattern, smooth transitions, divider, MotionConfig, data-icon test-coupling removal, aria-pressed alignment) are all baked into the reference files; no per-feature plan tasks are needed here.
