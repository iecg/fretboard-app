import { useEffect, useState } from "react";
import { useSetAtom } from "jotai";
import { resetAtom } from "../../store/atoms";
import { synth } from "../../core/audio";

export function useResetConfirmation(onConfirm: () => void) {
  const [resetConfirming, setResetConfirming] = useState(false);
  const dispatchReset = useSetAtom(resetAtom);

  const handleResetClick = () => {
    if (resetConfirming) {
      dispatchReset();
      synth.setMute(false);
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
