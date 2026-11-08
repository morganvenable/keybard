import { useState, type ReactNode } from "react";

const STORAGE_KEY = "keybard-more-keys-open";

function readOpen(id: string): boolean {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")[id] === true;
    } catch {
        return false;
    }
}

function writeOpen(id: string, open: boolean) {
    try {
        const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...all, [id]: open }));
    } catch {
        /* storage can be blocked */
    }
}

interface Props {
    /** The picker this group ends, such as "special" or "mouse". It keys the remembered open state. */
    category: string;
    /** How many keys it holds. */
    count: number;
    children: ReactNode;
    /** Compact picker strips have no room for the search slot. */
    compact?: boolean;
}

/**
 * The closed "More keys" group that ends a picker category. It is closed by
 * default and remembers being opened, per category, in this browser only.
 * The search slot is a labeled placeholder until key search lands.
 */
const MoreKeysDisclosure = ({ category, count, children, compact }: Props) => {
    const [open, setOpen] = useState(() => readOpen(category));
    return (
        <details
            className="flex flex-col gap-2"
            open={open}
            data-testid={`${category}-more-keys`}
            onToggle={(e) => {
                const isOpen = (e.currentTarget as HTMLDetailsElement).open;
                setOpen(isOpen);
                writeOpen(category, isOpen);
            }}
        >
            <summary className="cursor-pointer select-none font-semibold text-lg text-kb-ink">
                More keys <span className="text-sm font-normal text-muted-foreground">{count === 1 ? "1 key" : `${count} keys`}</span>
            </summary>
            <div className="flex flex-col gap-4 pt-2">
                {!compact && (
                    <div
                        className="flex items-center gap-2 rounded-lg border border-dashed border-kb-gray-border px-3 py-1 text-sm text-muted-foreground"
                        data-testid="more-keys-search-slot"
                        aria-disabled="true"
                    >
                        <span>Key search comes later</span>
                    </div>
                )}
                {children}
            </div>
        </details>
    );
};

export default MoreKeysDisclosure;
