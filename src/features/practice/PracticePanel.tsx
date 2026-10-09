import { usePanels } from "@/contexts/PanelsContext";

// Practice's detail panel content (docs/practice/spec.md §5.13): P3 Lesson on the Lessons page, G2
// Progress on the Progress page. Switching pages swaps the content in place. Esc closes the panel
// (SecondarySidebar, useWorkspacePanelEscape).
// TODO(practice): M1b fills P3 and G2's Profile and Scope sections; M4 adds G2's Data rows.

export default function PracticePanel({ horizontal = false }: { horizontal?: boolean }) {
    const { practicePage } = usePanels();
    const section = practicePage === "progress" ? "Progress" : "Lesson";
    return (
        <div
            data-practice-panel={practicePage}
            className={horizontal ? "flex flex-row flex-wrap items-start gap-4 py-2" : "flex flex-col gap-2 py-2"}
        >
            <div className="flex flex-row flex-wrap items-center justify-between p-3 gap-3 panel-layer-item">
                <span className="text-md text-left">{section} settings</span>
                <span className="text-xs text-muted-foreground">Not available yet</span>
            </div>
        </div>
    );
}
