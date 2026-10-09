import { usePanels } from "@/contexts/PanelsContext";
import type { PracticePage } from "@/layout/workspaces";
import { cn } from "@/lib/utils";

// P0 Practice frame (docs/practice/spec.md §5.1): title, the Lessons · Progress pills, and the page.
// The pages are placeholders until M1b (Lessons, Progress) and M0 (the hidden lab view).
// TODO(practice): M1b loads LessonsPage and ProgressPage as React.lazy chunks and adds the status pill.

const PAGES: { id: Exclude<PracticePage, "lab">; title: string }[] = [
    { id: "lessons", title: "Lessons" },
    { id: "progress", title: "Progress" },
];

const PAGE_TITLES: Record<PracticePage, string> = { lessons: "Lessons", progress: "Progress", lab: "Lab" };

export default function PracticeWorkspace({ active = true }: { active?: boolean }) {
    const { practicePage, setPracticePage } = usePanels();
    return (
        <div className="flex flex-col gap-4 px-6 pt-[22px] pb-6 max-w-[1600px] mx-auto w-full" data-active={active}>
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
            </header>
            <section
                aria-label={PAGE_TITLES[practicePage]}
                className="p-10 w-full max-w-xl mx-auto rounded-md border-dashed border-1 border-gray-300 dark:border-neutral-600 flex flex-col items-center gap-2 text-center"
            >
                <h2 className="text-base font-semibold text-kb-ink">{PAGE_TITLES[practicePage]}</h2>
                <p className="text-sm text-muted-foreground">Not available yet</p>
            </section>
        </div>
    );
}
