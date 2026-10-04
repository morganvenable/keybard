import SecondarySidebar from "../SecondarySidebar/SecondarySidebar";
import type { PickerMode } from "../SecondarySidebar/components/EditorSidePanel";
export const BOTTOM_PANEL_HEIGHT = 230;

/** Compatibility entry point; both placements use the same panel shell and registry. */
export default function BottomPanel(props: { leftOffset?: string; pickerMode?: PickerMode; height?: number }) {
    return <SecondarySidebar {...props} bottom />;
}
