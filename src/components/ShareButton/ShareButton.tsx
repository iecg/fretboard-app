import { useState } from "react";
import { useAtomValue } from "jotai";
import { Share2 } from "lucide-react";
import clsx from "clsx";
import { effectiveRootNoteAtom, effectiveScaleNameAtom, effectiveTempoAtom, effectiveBeatsPerBarAtom, effectiveTimeSignatureDenominatorAtom, effectiveProgressionStepsAtom } from "../../store/urlOverrideAtoms";
import { encodeShareUrl, type ShareState } from "../../utils/shareCodec";
import { Toast } from "../Toast/Toast";
import sharedStyles from "../shared/shared.module.css";

const BASE_URL = "https://iecg.github.io/fretboard-app/";

export function ShareButton() {
  const root = useAtomValue(effectiveRootNoteAtom);
  const scale = useAtomValue(effectiveScaleNameAtom);
  const tempo = useAtomValue(effectiveTempoAtom);
  const numerator = useAtomValue(effectiveBeatsPerBarAtom);
  const denominator = useAtomValue(effectiveTimeSignatureDenominatorAtom);
  const steps = useAtomValue(effectiveProgressionStepsAtom);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleShare = async () => {
    const state: ShareState = {
      root,
      scale,
      tempo,
      timeSignature: { numerator, denominator },
      steps: steps.map((s) => ({
        degree: s.degree,
        qualityOverride: s.qualityOverride,
        duration: s.duration,
      })),
    };

    const url = await encodeShareUrl(state, BASE_URL);

    if (typeof navigator.share === "function" && navigator.canShare?.({ url })) {
      try {
        await navigator.share({ url, title: `FretFlow — ${root} ${scale}` });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setToastMessage("Link copied");
    } catch {
      setToastMessage("Couldn't copy link");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        className={clsx(sharedStyles["icon-button"], sharedStyles["icon-button--sm"])}
        title="Share this song"
        aria-label="Share this song"
      >
        <Share2 className="icon" />
      </button>
      {toastMessage && (
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      )}
    </>
  );
}
