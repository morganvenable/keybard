import { lazy, Suspense } from "react";

import { usePanels } from "@/contexts/PanelsContext";
import type { PracticePage } from "@/layout/workspaces";
import { PracticeHeader } from "./PracticeHeader";

// P0 Practice frame (docs/practice/spec.md §5.1): the Lessons and Progress pages, each a React.lazy chunk,
// so the editor's initial bundle grows only by this frame (§4.1 Mounting, §9.8). The hidden lab view is
// M0's.

const LessonsPage = lazy(() => import("./ui/LessonsPage"));
const ProgressPage = lazy(() => import("./ui/progress/ProgressPage"));

const PAGE_TITLES: Record<PracticePage, string> = { lessons: "Lessons", progress: "Progress", lab: "Lab" };

export const PAGE_FRAME = "flex flex-col gap-4 px-6 pt-[22px] pb-6 max-w-[1600px] mx-auto w-full min-h-full";

function Loading() {
    return (
        <div className={PAGE_FRAME} data-practice-loading>
            <PracticeHeader />
        </div>
    );
}

export default function PracticeWorkspace({ active = true }: { active?: boolean }) {
    const { practicePage } = usePanels();
    if (practicePage === "lab") {
        // TODO(practice): M0 builds the measurement view (§4.2, Q7).
        return (
            <div className={PAGE_FRAME} data-active={active}>
                <PracticeHeader />
                <section aria-label={PAGE_TITLES.lab} className="p-10 w-full max-w-xl mx-auto rounded-md border-dashed border-1 border-gray-300 dark:border-neutral-600 flex flex-col items-center gap-2 text-center">
                    <h2 className="text-base font-semibold text-kb-ink">{PAGE_TITLES.lab}</h2>
                    <p className="text-sm text-muted-foreground">Not available yet</p>
                </section>
            </div>
        );
    }
    return (
        <Suspense fallback={<Loading />}>
            {practicePage === "progress" ? <ProgressPage active={active} /> : <LessonsPage active={active} />}
        </Suspense>
    );
}
