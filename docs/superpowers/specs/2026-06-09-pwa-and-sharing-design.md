# FretFlow: PWA and URL Sharing Design Spec

## Context and Goals
FretFlow is a client-side React application using Jotai for state management. Currently, all user state is persisted locally via `localStorage`. The goal of this project is to implement two major feature sets:
1. **URL Sharing:** Allow users to share specific musical configurations (key, scale, tuning, progression) via URL parameters.
2. **PWA & Offline Support:** Convert the app into a fully installable Progressive Web App (PWA) with offline caching and a custom install UI.
3. **Hardening:** Debounce URL state updates and harden the audio engine to support deep-linking into playing states.

## 1. URL State Sync & Sharing
### Data Flow & Architecture
- **URL as Hydrator, Jotai as Source of Truth:** We will keep Jotai atoms as the primary source of truth.
- **Musical Context Atoms:** Only specific atoms will be synced to the URL. These include: `rootNoteAtom`, `scaleTypeAtom`, `tuningNameAtom`, `progressionStepsAtom`, `voicingAtom`, and potentially `practiceLensAtom`.
- **Sync Mechanism:** We will build a custom Jotai effect/sync hook (`useUrlStateSync`) that:
  1. On mount: Parses `window.location.search`. If sharing parameters are present, it hydrates the relevant Jotai atoms, overriding the local storage values for that session.
  2. On change: Listens to the musical context atoms. When they change, it serializes the state to URL parameters and updates the URL using `window.location.replaceState()`.
- **Debouncing:** The URL update mechanism will be debounced by ~500ms. This prevents flooding the browser's history API when a user is actively scrubbing a progression or dragging a slider.

### Share UI
- **`ShareDialog` Component:** A new dialog accessible from the main UI (likely near the status bar or transport controls).
- **Features:**
  - A read-only text input displaying the current shareable URL.
  - A "Copy Link" button that copies the URL to the clipboard and provides visual feedback (toast or icon change).
  - A generated QR Code (using `qrcode.react`) to easily transfer the session to a mobile device.
  - A "Share" button invoking the native `navigator.share` API on supported mobile devices.

## 2. Progressive Web App (PWA)
### Service Worker & Caching
- **Vite Plugin PWA:** We will use `vite-plugin-pwa` configured in `vite.config.ts`.
- **Strategy:** `generateSW` to automatically cache all static assets (HTML, CSS, JS, images, fonts).
- **Updates:** We will implement an "Update Available" toast that notifies the user when a new version of the app is available, prompting them to refresh to activate the new Service Worker.

### Custom Install Flow
- **`usePWAInstall` Hook:** A custom React hook that captures the `beforeinstallprompt` browser event.
- **UI Integration:** We will add an "Install FretFlow" menu item within the existing `SettingsTooltip` component.
- **Behavior:** Clicking the menu item will invoke the native installation prompt. If the app is already installed, or if the browser doesn't support installation, this menu item will be hidden.

## 3. Audio Engine Hardening
- **Deep Linking Context:** Because users can now land on a URL that has a complex chord progression pre-loaded, the first user interaction is critical.
- **AudioContext Resumption:** We will audit `src/core/audio.ts` to ensure that the Web Audio API `AudioContext` is properly unlocked on the *first* interaction (click/tap) after page load.
- **Background Suspension:** We will verify that Safari/Chrome backgrounding behavior (which suspends the AudioContext) is gracefully handled, automatically resuming when the app returns to the foreground.

## Edge Cases and Error Handling
- **Malformed URLs:** If a URL contains invalid state (e.g., a non-existent scale or malformed JSON progression), the app must gracefully ignore the bad parameters and fall back to `localStorage` or default state.
- **Storage Limits:** URL lengths must be kept reasonable. We will serialize the state compactly (e.g., mapping progression chords to short strings) if necessary.

## Scope Check
This spec covers URL syncing, sharing UI, PWA configuration, and targeted audio hardening. These features are tightly related (sharing links to mobile often leads to PWA installation) and can be executed within a single implementation plan.
