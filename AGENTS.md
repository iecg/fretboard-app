# FretFlow — Agent Guide

This file provides guidance for AI coding agents working in this repository.
See `CLAUDE.md` for full project detail (Claude Code reads that automatically).

## Quick reference

- **Stack:** React 19 + TypeScript + Vite, deployed to GitHub Pages
- **Tests:** `npm run test` (vitest)
- **Lint:** `npm run lint`
- **Build:** `npm run build`

## Releasing

Version is managed via `npm version` — **never edit `package.json` version by hand**.

```bash
npm version patch|minor|major
git push && git push --tags
```

Pushing a `v*.*.*` tag deploys to GitHub Pages and creates a GitHub Release automatically.

## Rules

- Do not push directly to `main`
- Do not skip lint or tests before committing
- Do not bump `major` without explicit human approval
- Copyright: © Isaac Cocar. All rights reserved.
