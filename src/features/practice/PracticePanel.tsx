import { lazy, Suspense } from "react";

import { usePanels } from "@/contexts/PanelsContext";

// Practice's detail panel content (docs/practice/spec.md §5.13): P3 Lesson on the Lessons page, G2
// Progress on the Progress page. Switching pages swaps the content in place. Esc closes the panel
// (SecondarySidebar, useWorkspacePanelEscape). Both are lazy, in Practice's chunks (§9.8).

const LessonPanel = lazy(() => import("./ui/LessonPanel"));
const ProgressPanel = lazy(() => import("./ui/progress/ProgressPanel"));

export default function PracticePanel({ horizontal = false }: { horizontal?: boolean }) {
    const { practicePage } = usePanels();
    return (
        <div data-practice-panel-root={practicePage}>
            <Suspense fallback={null}>
                {practicePage === "progress" ? <ProgressPanel horizontal={horizontal} /> : <LessonPanel horizontal={horizontal} />}
            </Suspense>
        </div>
    );
}
