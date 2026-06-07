import type { DiagramId } from "../helpContent";
import { NoteRoleLegendDiagram } from "./NoteRoleLegendDiagram";
import { ShapeDiagram } from "./ShapeDiagram";
import { VoiceLeadingDiagram } from "./VoiceLeadingDiagram";
import { ShortcutTableDiagram } from "./ShortcutTableDiagram";

export function HelpDiagram({ id }: { id: DiagramId }) {
  switch (id) {
    case "noteRoleLegend":
      return <NoteRoleLegendDiagram />;
    case "shapes":
      return <ShapeDiagram />;
    case "voiceLeading":
      return <VoiceLeadingDiagram />;
    case "shortcutTable":
      return <ShortcutTableDiagram />;
    default:
      return null;
  }
}
