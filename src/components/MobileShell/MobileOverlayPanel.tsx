import { lazy, Suspense } from "react";
import { useAtom } from "jotai";
import { mobilePanelAtom } from "@fretflow/fretboard/store/uiAtoms";
import { useTranslation } from "../../hooks/useTranslation";
import { MobilePanel } from "./MobilePanel";

// Same code-split point the lazy desktop Inspector provides: the Overlay
// controls only load when the panel first opens.
const ViewTab = lazy(() =>
  import("../Inspector/ViewTab").then((m) => ({ default: m.ViewTab })),
);

/**
 * Overlay-controls drawer, anchored above the MobileDock. The board stays
 * visible (and interactive) above it — see MobilePanel for the shared
 * non-modal contract.
 */
export function MobileOverlayPanel() {
  const { t } = useTranslation();
  const [panel, setPanel] = useAtom(mobilePanelAtom);

  return (
    <MobilePanel
      panelId="overlay"
      open={panel === "overlay"}
      onClose={() => setPanel("none")}
      title={t("inspector.viewTab")}
      closeLabel={t("mobilePanels.closeOverlay")}
    >
      <Suspense fallback={null}>
        <ViewTab />
      </Suspense>
    </MobilePanel>
  );
}
