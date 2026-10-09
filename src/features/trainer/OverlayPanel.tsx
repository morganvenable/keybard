// Overlay's detail panel content, O2 (docs/practice/spec.md §5.15). Not reachable until MO: Overlay
// opens no panel yet (WORKSPACE_HAS_PANEL.overlay) and TrainerPage keeps its own inspector.
// Esc closes the panel (SecondarySidebar, useWorkspacePanelEscape).
// TODO(practice): MO builds the Window · Appearance · Feedback · Recall tiles here.

export default function OverlayPanel({ horizontal = false }: { horizontal?: boolean }) {
    return (
        <div
            data-overlay-panel
            className={horizontal ? "flex flex-row flex-wrap items-start gap-4 py-2" : "flex flex-col gap-2 py-2"}
        >
            <div className="flex flex-row flex-wrap items-center justify-between p-3 gap-3 panel-layer-item">
                <span className="text-md text-left">Overlay settings</span>
                <span className="text-xs text-muted-foreground">Not available yet</span>
            </div>
        </div>
    );
}
