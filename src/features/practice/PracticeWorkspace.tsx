import { lazy, Suspense } from "react";

import { usePanels } from "@/contexts/PanelsContext";
import { PracticeHeader } from "./PracticeHeader";

// P0 Practice frame (docs/practice/spec.md §5.1): the Lessons and Progress pages, each a React.lazy chunk,
// so the editor's initial bundle grows only by this frame (§4.1 Mounting, §9.8). The hidden M0 lab
// (?practiceLab=1#practice/lab, OWNER_Q7) is a lazy chunk too.

const LessonsPage = lazy(() => import("./ui/LessonsPage"));
const ProgressPage = lazy(() => import("./ui/progress/ProgressPage"));
const LabPage = lazy(() => import("./ui/LabPage"));

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
    return (
        <Suspense fallback={<Loading />}>
            {practicePage === "lab" ? <LabPage active={active} /> : practicePage === "progress" ? <ProgressPage active={active} /> : <LessonsPage active={active} />}
        </Suspense>
    );
}
