import { type RefObject, useEffect } from "react";
import { useAtomValue } from "jotai";
import { openModalSheetCountAtom } from "../../store/uiAtoms";

/**
 * Counteract the spurious `aria-hidden` that the always-open, non-modal
 * persistent `MobileSheet` inflicts on the rest of the mobile app.
 *
 * ## Why this exists
 * `MobileSheet` renders a vaul `Drawer.Root` with `modal={false}`. vaul 1.1.2
 * (latest) does **not** forward that `modal` prop to the underlying Radix
 * `DialogPrimitive.Root` (see `node_modules/vaul/dist/index.mjs` — it calls
 * `createElement(DialogPrimitive.Root, { defaultOpen, onOpenChange, open })`
 * with no `modal`). Radix therefore defaults to `modal={true}`, runs
 * `DialogContentModal`, and calls `hideOthers()` from the `aria-hidden`
 * package. Because the sheet is always open, the shell's header, progression
 * track, and fretboard stage are *permanently* marked
 * `aria-hidden="true"` + `data-aria-hidden="true"` — invisible to VoiceOver /
 * TalkBack. There is no supported vaul prop to disable this in 1.1.2.
 *
 * ## What this does
 * While mounted, a `MutationObserver` on the shell root strips `aria-hidden`
 * (and the `data-aria-hidden` marker) the moment they appear on the shell or
 * any descendant, keeping the shell reachable by assistive tech — exactly the
 * non-modal behavior the sheet intends.
 *
 * ## The modal interaction (critical)
 * The Settings / Help sheets (`AdaptiveModal` with `presentation="sheet"`) ARE
 * genuinely modal and *should* aria-hide the background — including this shell.
 * `aria-hidden` reference-counts its hiding, so when such a modal opens the
 * shell's `aria-hidden` reflects both the persistent sheet AND the modal; when
 * it closes, only the persistent sheet's (spurious) hiding remains. We must not
 * fight the modal. So:
 *   - While any modal sheet is open (`openModalSheetCountAtom > 0`) the observer
 *     stands down and leaves the background hidden (correct modal behavior).
 *   - When the count returns to 0, the observer re-asserts and sweeps away the
 *     lingering persistent-sheet hiding (closing the modal does not itself
 *     mutate the shell's attribute — the reference counter just drops from 2 to
 *     1 — so we re-scan on the count transition rather than relying on a
 *     mutation).
 *
 * @param shellRef ref to the shell root element (`[data-testid="mobile-shell"]`)
 */
export function useUnhideMobileShell(
  shellRef: RefObject<HTMLElement | null>,
): void {
  const openModalSheetCount = useAtomValue(openModalSheetCountAtom);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    // A genuine modal sheet is open: it SHOULD hide this shell. Stand down.
    if (openModalSheetCount > 0) return;

    const ATTRS = ["aria-hidden", "data-aria-hidden"] as const;

    /** Strip the spurious hiding markers from one element, if present. */
    const unhide = (el: Element): void => {
      if (el.getAttribute("aria-hidden") === "true") {
        el.removeAttribute("aria-hidden");
      }
      if (el.getAttribute("data-aria-hidden") === "true") {
        el.removeAttribute("data-aria-hidden");
      }
    };

    /** Sweep the shell root + every descendant. */
    const sweep = (): void => {
      unhide(shell);
      shell
        .querySelectorAll('[aria-hidden="true"], [data-aria-hidden="true"]')
        .forEach(unhide);
    };

    // Initial sweep: when this effect (re)runs after a modal closes, the
    // persistent sheet's hiding is still applied but produced no fresh
    // mutation — clear it now.
    sweep();

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        const target = record.target;
        if (target instanceof Element) unhide(target);
      }
    });

    observer.observe(shell, {
      subtree: true,
      attributes: true,
      attributeFilter: [...ATTRS],
    });

    return () => observer.disconnect();
  }, [shellRef, openModalSheetCount]);
}
