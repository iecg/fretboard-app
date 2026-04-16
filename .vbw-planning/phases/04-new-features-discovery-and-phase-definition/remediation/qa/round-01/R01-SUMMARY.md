---
phase: 4
round: 1
plan: R01
title: "Phase 04 QA Round 01 — Plan amendments for deviation alignment"
type: remediation
status: complete
started: 2026-04-15
completed: 2026-04-15
tasks_completed: 6
tasks_total: 6
commit_hashes:
  - e63e219
files_modified:
  - .vbw-planning/phases/04-new-features-discovery-and-phase-definition/04-01-PLAN.md
  - .vbw-planning/phases/04-new-features-discovery-and-phase-definition/04-02-PLAN.md
  - .vbw-planning/phases/04-new-features-discovery-and-phase-definition/04-03-PLAN.md
  - .vbw-planning/phases/04-new-features-discovery-and-phase-definition/04-04-PLAN.md
  - .vbw-planning/phases/04-new-features-discovery-and-phase-definition/04-05-PLAN.md
  - .vbw-planning/phases/04-new-features-discovery-and-phase-definition/remediation/qa/round-01/R01-PLAN.md
  - .vbw-planning/phases/04-new-features-discovery-and-phase-definition/remediation/qa/round-01/R01-SUMMARY.md
deviations: []
fail_classifications:
  - {id: "DEV-01", type: "process-exception", rationale: "Shared-worktree commit bundling is a historical git-state issue — 04-03's changes landed inside commit e7d9b7d (authored by dev-04-04's agent) before dev-04-03 could create its own commit. Un-batching a committed tree without risky interactive rebase would destabilize history. All 04-03 deliverables are verifiably present in that commit (verified by QA) and lint/test/build pass. Non-fixable retroactively without compensating risk."}
  - {id: "DEV-02", type: "plan-amendment", rationale: "Plan 04-02 specified importing from 'vitest-axe/extend-expect', which is a non-functional/empty module in vitest-axe v0.1.0. Dev correctly replaced with 'vitest-axe/matchers' direct expect.extend call. Updated 04-02-PLAN.md to document the actual import path."}
  - {id: "DEV-03", type: "plan-amendment", rationale: "Plan 04-03 did not anticipate that new Phase-5 primitive files (from concurrent 04-05) would require Node type support via tsconfig for primitives-unused.test.ts. Updated 04-03-PLAN.md to acknowledge this cross-wave dependency."}
  - {id: "DEV-04", type: "plan-amendment", rationale: "Plan 04-03 specified updating the ScaleChordControls chord-root label — but the label was already a <span>. Updated 04-03-PLAN.md to remove this task bullet, documenting the pre-existing correct state."}
  - {id: "DEV-05", type: "plan-amendment", rationale: "Plan 04-04 specified adding role='img' to FretboardSVG's outer <svg>. FretboardSVG renders a React fragment so the Dev wrapped it in <div role='img'>. Updated 04-04-PLAN.md to reflect the div-wrapper approach as the intended outcome."}
  - {id: "DEV-06", type: "plan-amendment", rationale: "Plan 04-01 specified adding --fret-wire token. Pre-existing index.css already defines --fret-wire. Dev renamed to --fret-wire-v2. Updated 04-01-PLAN.md to document the rename."}
  - {id: "DEV-07", type: "plan-amendment", rationale: "Plan 04-01 specified aliasing --header-surface to --color-surface-1, a token that doesn't exist. Dev correctly aliased to --surface-base. Updated 04-01-PLAN.md to document the correct alias target."}
  - {id: "DEV-08", type: "plan-amendment", rationale: "Plan 04-05 specified BottomTabBar as <ul role='tablist'><li><button role='tab'>. This pattern violates axe's aria-required-parent rule. Updated 04-05-PLAN.md to document the correct <div role='tablist'><button role='tab'> pattern."}
  - {id: "DEV-09", type: "plan-amendment", rationale: "Plan 04-05 specified <ul role='list'> for DegreeChipStrip. Both axe and eslint-plugin-jsx-a11y flag redundant role='list'. Dev removed the redundant attribute. Updated 04-05-PLAN.md to remove the redundant role."}
  - {id: "ANTI-01", type: "plan-amendment", rationale: "QA's verification check was written too literally. Plan 04-01 must_haves.truths states Phase-5 tokens are unused in existing *.css files, but 04-05 legitimately creates NEW primitive files that consume them. Updated 04-01-PLAN.md to carve out 04-05's new primitive files as legitimate consumers."}
---

Phase 04 QA Round 01 remediation reconciles 9 plan-amendment deviations and 1 process-exception (DEV-01) by appending `## Deviations Reconciled (R01)` sections to all 5 affected phase PLAN.md files. No product code was changed.

## DEV-01 Process-Exception Justification

DEV-01 (shared-worktree commit bundling) is a process-exception: during Wave 2 parallel execution, dev-04-04's agent committed first and inadvertently included dev-04-03's staged changes in commit e7d9b7d. All 04-03 deliverables are verifiably present in that commit (QA confirmed). Un-batching committed history via interactive rebase would require rewriting a pushed commit tree without consensus on which edits belong to which logical unit; the risk (broken history, merge conflicts for any branch built atop this one) exceeds the benefit (cosmetic separation of already-verified work). A compensating control is already in place via this R01-SUMMARY.md record, which documents the commit-boundary issue and attributes 04-03's changes to their logical owner. Future mitigation: `worktree_isolation` config option exists for true parallel isolation; Phase 4 ran with `worktree_isolation=off` by configuration choice.

## Task 1: Amend 04-01-PLAN.md — DEV-06, DEV-07, ANTI-01

### What Was Built
- Appended `## Deviations Reconciled (R01)` section documenting --fret-wire rename, --header-surface alias correction, and Phase-5 token consumption scope clarification

### Files Modified
- `.vbw-planning/phases/04-new-features-discovery-and-phase-definition/04-01-PLAN.md` -- appended: Deviations Reconciled section covering DEV-06, DEV-07, ANTI-01

### Deviations
No deviations

## Task 2: Amend 04-02-PLAN.md — DEV-02

### What Was Built
- Appended `## Deviations Reconciled (R01)` section documenting vitest-axe import path correction

### Files Modified
- `.vbw-planning/phases/04-new-features-discovery-and-phase-definition/04-02-PLAN.md` -- appended: Deviations Reconciled section covering DEV-02

### Deviations
No deviations

## Task 3: Amend 04-03-PLAN.md — DEV-03, DEV-04

### What Was Built
- Appended `## Deviations Reconciled (R01)` section documenting tsconfig cross-wave dependency and ScaleChordControls no-op clarification

### Files Modified
- `.vbw-planning/phases/04-new-features-discovery-and-phase-definition/04-03-PLAN.md` -- appended: Deviations Reconciled section covering DEV-03, DEV-04

### Deviations
No deviations

## Task 4: Amend 04-04-PLAN.md — DEV-05

### What Was Built
- Appended `## Deviations Reconciled (R01)` section documenting FretboardSVG div wrapper approach for role=img

### Files Modified
- `.vbw-planning/phases/04-new-features-discovery-and-phase-definition/04-04-PLAN.md` -- appended: Deviations Reconciled section covering DEV-05

### Deviations
No deviations

## Task 5: Amend 04-05-PLAN.md — DEV-08, DEV-09

### What Was Built
- Appended `## Deviations Reconciled (R01)` section documenting BottomTabBar correct tablist pattern and DegreeChipStrip redundant role removal

### Files Modified
- `.vbw-planning/phases/04-new-features-discovery-and-phase-definition/04-05-PLAN.md` -- appended: Deviations Reconciled section covering DEV-08, DEV-09

### Deviations
No deviations

## Task 6: Commit and verify

### What Was Built
- Single commit staging all 5 amended PLAN.md files + R01-PLAN.md + R01-SUMMARY.md
- Verified npm run lint, npm run test, npm run build all pass (no regressions from markdown-only changes)

### Files Modified
- All files listed in frontmatter `files_modified` staged and committed

### Deviations
No deviations
