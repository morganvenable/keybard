import { Popover } from "radix-ui";
import { useChanges } from "@/contexts/ChangesContext";

/** Keep the review outside the horizontally scrolling editor toolbar. */
export default function PendingChangesPopover() {
    const { getPendingChanges } = useChanges();
    const changes = getPendingChanges();
    if (!changes.length) return null;

    return (
        <Popover.Root>
            <Popover.Trigger asChild>
                <button type="button" className="rounded px-1 py-1 text-xs cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2">
                    Pending ({changes.length})
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    aria-label="Pending changes"
                    side="bottom"
                    align="start"
                    sideOffset={8}
                    collisionPadding={12}
                    className="z-[80] w-80 max-w-[calc(100vw-24px)] max-h-[min(24rem,var(--radix-popover-content-available-height))] overflow-y-auto whitespace-normal break-words rounded-md border border-kb-gray-border bg-kb-surface p-3 text-sm text-kb-ink shadow-lg"
                >
                    <h2 className="mb-2 font-semibold">Pending changes ({changes.length})</h2>
                    <ul className="space-y-2" aria-label="Changes waiting to be applied">
                        {changes.map(change => (
                            <li key={change.writeKey || change.desc}>{change.desc}</li>
                        ))}
                    </ul>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
