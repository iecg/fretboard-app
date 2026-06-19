import { lazy, Suspense } from "react";
import { useAtom } from "jotai";
import { mobilePanelAtom } from "@fretflow/fretboard/store/uiAtoms";
import { useTranslation } from "../../hooks/useTranslation";
import { MobilePanel } from "./MobilePanel";

// Code-split: SongControls is the heaviest control subtree; load on first open.
const SongControls = lazy(() =>
  import("../SongControls/SongControls").then((m) => ({ default: m.SongControls })),
);

/**
 * Song setup drawer — the same MobilePanel surface as the Overlay panel, just
 * taller: it rises to just below the progression track so the timeline and
 * the transport strip stay visible (and usable) while editing the song.
 * Renders in-tree inside the MobileShell, so tier/variant-scoped CSS applies
 * without re-stamping.
 */
export function MobileSongPanel() {
  const { t } = useTranslation();
  const [panel, setPanel] = useAtom(mobilePanelAtom);

  return (
    <MobilePanel
      panelId="song"
      open={panel === "song"}
      onClose={() => setPanel("none")}
      title={t("inspector.songTab")}
      closeLabel={t("mobilePanels.closeSong")}
    >
      <Suspense fallback={null}>
        <SongControls />
      </Suspense>
    </MobilePanel>
  );
}
