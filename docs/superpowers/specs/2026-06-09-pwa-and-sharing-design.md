# FretFlow: PWA & URL Sharing Design Spec

## Context

FretFlow is a client-side React 19 + TypeScript guitar fretboard app deployed to GitHub Pages. All user state is persisted locally via Jotai `atomWithStorage` to localStorage. There is no backend.

The app has a basic `site.webmanifest` and OG/Twitter meta tags, but no service worker, no offline support, no installability, and no way to share fretboard configurations via URL.

## Goals

1. **URL Sharing** — One-button sharing of song configurations (key, scale, progression, tempo, time signature) via encoded URLs.
2. **PWA & Offline** — Full installability with offline caching so the app works without internet.
3. **Install Prompt** — A one-time dismissible banner encouraging installation on supported browsers.

## Non-Goals

- Sharing fingering patterns, chord overlays, voicings, or visual preferences (these are personal preference)
- Sharing backing track mix settings (instrument enables, genre, patterns, variations, swing)
- Server-side rendering or dynamic OG tags
- Inbound share target (receiving shared content from other apps)
- QR code generation (can be added later)
- Audio engine hardening (out of scope for this spec)

---

## 1. URL State Codec

### Encoding Format

A single `s` query parameter with dot-separated sections:

```
?s=C.major.120.4x4.I-vi:m7-IV-V:7
     │   │    │   │   └─ chord sequence
     │   │    │   └─ time signature (4x4 = 4/4)
     │   │    └─ tempo BPM
     │   └─ scale name
     └─ root note
```

### Chord Encoding

Each chord in the sequence is hyphen-separated: `degree[:qualityOverride][*duration]`

- `I` — degree I, default quality, default duration (1 bar)
- `vi:m7` — degree vi with quality override to m7
- `IV*2b` — degree IV, 2 bars duration
- `V:7*2bt` — degree V, dominant 7th, 2 beats

Duration suffixes: `b` = bar (default, omitted when 1 bar), `bt` = beat. Numeric prefix = count.

### ShareState Type

```ts
type ShareState = {
  root: string;        // "C", "F#", etc.
  scale: string;       // "major", "natural minor", etc.
  tempo: number;
  timeSignature: { numerator: number; denominator: number };
  steps: Array<{
    degree: string;
    qualityOverride: string | null;
    duration: { value: number; unit: "bar" | "beat" };
  }>;
};
```

### Module

`src/utils/shareCodec.ts` — pure functions, no React dependencies:

- `encodeShareState(state: ShareState): string` — returns the encoded `s` param value
- `decodeShareState(param: string): ShareState | null` — returns parsed state or null on malformed input

### Compression Fallback

If the encoded string exceeds 1500 characters (very long custom progressions), fall back to a `z` query parameter containing `lz-string`'s `compressToEncodedURIComponent` output of the JSON-serialized state. The decoder checks `z` first, then `s`.

`lz-string` is added as a dependency. The codec imports it lazily (dynamic import) so it doesn't affect bundle size for the common case.

---

## 2. URL ↔ App State Integration

### The Problem

Jotai's `atomWithStorage` writes to localStorage on every `set()`. Shared links must apply state temporarily without corrupting the user's saved preferences.

### Solution: Derived Atom Override Layer

A single plain atom holds the decoded URL state:

```ts
const urlOverridesAtom = atom<ShareState | null>(null);
```

For each shareable persisted atom, create a read-only derived "effective" atom:

```ts
const effectiveRootNoteAtom = atom((get) => {
  const overrides = get(urlOverridesAtom);
  return overrides?.root ?? get(rootNoteAtom);
});
```

Components read from `effective*` atoms. User interactions write to the real persisted atoms as normal. The override layer sits in front and never touches localStorage.

### Why This Approach

- `useHydrateAtoms` calls `store.set()` which triggers localStorage writes — corrupts saved state.
- Scoped Jotai Providers don't help because `atomWithStorage` always targets global localStorage regardless of Provider.
- Snapshot/restore is fragile — if the user closes the tab mid-session, preferences are lost (Excalidraw has this exact bug).
- The derived overlay is zero-risk: localStorage is never written, and clearing the override is a single atom write.

### Inbound Flow (Opening a Shared Link)

1. `useShareLinkHandler` hook runs on app mount
2. Checks for `s` or `z` query param
3. Decodes via the codec
4. Sets `urlOverridesAtom` with the decoded state
5. Strips query params from URL via `history.replaceState`

### Shared Link Banner

When `urlOverridesAtom` is non-null, a slim banner appears:

> "Viewing shared song — C major I-vi-IV-V" [✕]

Dismissing the banner (✕) sets `urlOverridesAtom` to null, reverting all state to the user's saved values.

When the user changes any overridden setting (e.g., edits the progression, changes root note), the entire `urlOverridesAtom` is set to null — all overrides clear at once and the shared-link banner dismisses. The user has taken ownership of the session. Per-field granularity is unnecessary complexity.

### Outbound Flow (Generating a Share URL)

The share button reads from the real persisted atoms (not the override layer) to build the URL. If overrides are active, it reads from the override values instead. In practice: read from the effective atoms.

---

## 3. Share Button & Web Share API

### Placement

A share icon button in the header bar, alongside existing controls.

### Behavior

1. Read current shareable state from effective atoms (root, scale, tempo, time sig, progression steps)
2. Encode via the codec
3. Build full URL: `https://iecg.github.io/fretboard-app/?s=...`
4. **Mobile** (`navigator.canShare()` returns true): call `navigator.share({ url, title })`
5. **Desktop / fallback**: copy URL to clipboard via `navigator.clipboard.writeText()`, show toast

### Toast

A small auto-dismissing notification (2-3 seconds): "Link copied". Minimal component — no toast library. If no existing toast pattern exists in the app, create a lightweight one.

### Edge Cases

- No progression active: share button still works, encodes default progression state
- `navigator.share()` throws on user cancel: catch silently, no error toast
- Clipboard write fails (rare, requires HTTPS + secure context): show "Couldn't copy link" toast with the URL displayed for manual copy

---

## 4. PWA — Service Worker & Offline

### Plugin

`vite-plugin-pwa` added as a dev dependency, configured in `vite.config.ts`.

### Service Worker Configuration

- `registerType: 'autoUpdate'` — seamless background updates, no "new version available" prompts
- Workbox `generateSW` strategy
- **CacheFirst** for all precached assets (JS/CSS/images are content-hashed by Vite)
- `navigateFallback: '/fretboard-app/index.html'` — serves app shell for all navigation requests
- Scope: `/fretboard-app/`

### Cached Assets

- All Vite-built JS/CSS chunks
- HTML shell
- Icons and static assets from `public/`
- Google Fonts: runtime caching rule — `StaleWhileRevalidate` for CSS, `CacheFirst` with 1-year expiry for font files

### Manifest Upgrade

The existing `public/site.webmanifest` needs:

- 192×192 and 512×512 PNG icons (currently only 32×32 and 180×180)
- `"id": "/fretboard-app/"` for stable PWA identity
- Keep existing fields (name, short_name, description, display, colors)

### GitHub Pages Deep Link Support

Add to the build script: `cp dist/index.html dist/404.html`

This ensures that navigating directly to a shared link URL (e.g., refreshing `?s=...`) returns the app shell instead of GitHub's 404 page. The service worker's `navigateFallback` handles this once cached, but the 404.html copy covers the first-visit/uncached case.

---

## 5. Install Banner

### Trigger Logic

1. Listen for the `beforeinstallprompt` event
2. Show the banner only when ALL of:
   - `beforeinstallprompt` event has fired (banner is actionable)
   - Not previously dismissed (`fretflow:installDismissed` not in localStorage)
   - Not already installed (`display-mode: standalone` media query is false)
   - Not first visit (visit count ≥ 2, tracked via `fretflow:visitCount` in localStorage)
3. Store the deferred prompt event to call `.prompt()` on user tap

### Banner UI

- Slim dismissible bar below the header or above the fretboard
- Text: "Install FretFlow for offline practice" + [Install] button + [✕] dismiss
- Styled with the app's design tokens / theme
- Animates in via motion

### Dismiss Behavior

- ✕ sets `fretflow:installDismissed = true` in localStorage — permanent
- `appinstalled` event fires → hide banner
- Inside installed app (`display-mode: standalone`): banner never renders

### Safari / Firefox

No banner shown — these browsers don't fire `beforeinstallprompt`. Safari users can still "Add to Home Screen" from the share sheet. Not worth a custom instruction banner for v1.

---

## 6. Testing Strategy

### Unit Tests

- **`shareCodec.ts`**: encode/decode roundtrips, edge cases (empty progression, max-length URLs, special characters in scale names, quality overrides, mixed durations), lz-string fallback threshold, malformed input returns null
- **Override atom layer**: verify `effective*` atoms read from overrides when set, fall back to persisted atoms when null, clear correctly on dismiss
- **Install banner logic**: mock `beforeinstallprompt`, localStorage flags, `display-mode` media query

### Component Tests

- **Share button**: mock `navigator.share` and `navigator.clipboard.writeText`, verify correct URL generation, verify toast appears on copy
- **Install banner**: renders when all conditions met, dismisses permanently, doesn't render when already installed or first visit
- **Shared link banner**: renders when URL overrides active, clears on dismiss, state reverts

### E2E (Playwright)

- Share flow: set a progression → tap share → verify clipboard contains valid encoded URL → navigate to that URL → verify progression loads correctly
- Shared link banner: open shared URL → verify banner visible → verify state matches → dismiss → verify return to default state

### Visual Regression

No changes to existing visual suites expected. Add snapshots for new components (share button, install banner, shared-link banner) in the appropriate suite.

---

## Dependencies

| Package | Purpose | Type |
|---------|---------|------|
| `vite-plugin-pwa` | Service worker generation, manifest integration | devDependency |
| `lz-string` | URL compression fallback for long progressions | dependency |

---

## File Layout (New Files)

```
src/
├── utils/
│   ├── shareCodec.ts              # encode/decode share state
│   └── shareCodec.test.ts
├── store/
│   ├── urlOverrideAtoms.ts        # urlOverridesAtom + effective* derived atoms
│   └── urlOverrideAtoms.test.ts
├── hooks/
│   ├── useShareLinkHandler.ts     # parse URL on mount, set overrides
│   └── usePWAInstall.ts           # beforeinstallprompt capture + install logic
├── components/
│   ├── ShareButton/
│   │   ├── ShareButton.tsx
│   │   ├── ShareButton.module.css
│   │   └── ShareButton.test.tsx
│   ├── InstallBanner/
│   │   ├── InstallBanner.tsx
│   │   ├── InstallBanner.module.css
│   │   └── InstallBanner.test.tsx
│   ├── SharedLinkBanner/
│   │   ├── SharedLinkBanner.tsx
│   │   ├── SharedLinkBanner.module.css
│   │   └── SharedLinkBanner.test.tsx
│   └── Toast/
│       ├── Toast.tsx
│       ├── Toast.module.css
│       └── Toast.test.tsx
public/
├── icon-192x192.png               # new PWA icon
└── icon-512x512.png               # new PWA icon
```

Modified files: `vite.config.ts`, `public/site.webmanifest`, `package.json`, `src/App.tsx`, header component (for share button placement).
