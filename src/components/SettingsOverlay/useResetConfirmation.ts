import { useEffect, useState } from "react";
import { useSetAtom } from "jotai";
import { resetAtom } from "@fretflow/fretboard/store/actions";
import { setGuitarMutePreference } from "@fretflow/fretboard/core/lazyGuitarAudio";

export function useResetConfirmation(onConfirm: () => void) {
  const [resetConfirming, setResetConfirming] = useState(false);
  const dispatchReset = useSetAtom(resetAtom);

  const handleResetClick = () => {
    if (resetConfirming) {
      dispatchReset();
      setGuitarMutePreference(false);
      onConfirm();
    } else {
      setResetConfirming(true);
    }
  };

  useEffect(() => {
    if (!resetConfirming) return;
    const t = setTimeout(() => setResetConfirming(false), 3000);
    return () => clearTimeout(t);
  }, [resetConfirming]);

  return { resetConfirming, handleResetClick };
}
