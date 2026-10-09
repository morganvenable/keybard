import type { ReactNode } from "react";

import { usePanels } from "@/contexts/PanelsContext";
import type { PracticePage } from "@/layout/workspaces";
import { cn } from "@/lib/utils";

// P0 header row (docs/practice/spec.md §5.1): the title Practice, the Lessons · Progress pills (layer-pill
// idiom, page navigation only), and the page's right-hand item (the input status pill on Lessons, the
// profile and period as text on Progress).

const PAGES: { id: Exclude<PracticePage, "lab">; title: string }[] = [
    { id: "lessons", title: "Lessons" },
    { id: "progress", title: "Progress" },
];

export function PracticeHeader({ right }: { right?: ReactNode }) {
    const { practicePage, setPracticePage } = usePanels();
    return (
        <header className="flex items-center gap-4 flex-wrap">
            <h1 className="text-[22px] font-semibold leading-none text-kb-ink">Practice</h1>
            <nav aria-label="Practice pages" className="flex items-center gap-1">
                {PAGES.map((page) => {
                    const current = practicePage === page.id;
                    return (
                        <button
                            key={page.id}
                            type="button"
                            aria-current={current ? "page" : undefined}
                            onClick={() => setPracticePage(page.id)}
                            className={cn(
                                "px-4 py-1 rounded-full transition-colors text-sm font-medium cursor-pointer border-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 whitespace-nowrap",
                                current
                                    ? "bg-gray-800 text-white dark:bg-neutral-200 dark:text-neutral-900 shadow-md scale-105"
                                    : "bg-transparent text-gray-600 dark:text-neutral-300 hover:bg-gray-200 dark:hover:bg-neutral-700"
                            )}
                        >
                            {page.title}
                        </button>
                    );
                })}
            </nav>
            {right && <div className="ml-auto flex items-center gap-2 min-w-0">{right}</div>}
        </header>
    );
}

export default PracticeHeader;
