import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { urlOverridesAtom } from "../store/urlOverrideAtoms";
import { decodeShareUrl } from "../utils/shareCodec";

export function useShareLinkHandler(): void {
  const setOverrides = useSetAtom(urlOverridesAtom);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("s") && !params.has("z")) return;

    const state = decodeShareUrl(params);
    if (!state) return;

    setOverrides(state);

    // Strip share params from URL without triggering navigation
    const url = new URL(window.location.href);
    url.searchParams.delete("s");
    url.searchParams.delete("z");
    window.history.replaceState(null, "", url.pathname + url.hash);
  }, [setOverrides]);
}
