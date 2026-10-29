import type { FC, ReactNode } from "react";
import { CirclePause, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { testerNoteFromSearch, type TesterNoteStyle } from "@/lib/deepLinks";

export type TesterNoteKind = "paused" | "unsupported";

export interface MatrixTesterNoteProps {
    kind: TesterNoteKind;
    /** How the note names the exit key ("Esc", or the fallback pair). */
    exitName: string;
    /** Opens Keybard's firmware update (older firmware only). */
    onUpdateFirmware?: () => void;
    /** Which look; default from ?testerNote, else A. */
    variant?: TesterNoteStyle;
}

/** The note's words, the same in every look: a heading sentence and the rest. */
function words(kind: TesterNoteKind, exitName: string, onUpdateFirmware?: () => void): { heading: string; body: ReactNode } {
    if (kind === "unsupported") {
        return {
            heading: "Your firmware can't pause typing yet.",
            body: (
                <>
                    Keys may still reach your computer, including Windows and Tab.{" "}
                    <button
                        type="button"
                        onClick={onUpdateFirmware}
                        className="cursor-pointer font-medium text-kb-primary underline underline-offset-2"
                        data-tester-update-firmware=""
                    >
                        Update firmware
                    </button>{" "}
                    to pause them while you test.
                </>
            ),
        };
    }
    return {
        heading: "Typing from your Svalboard is paused while the tester is open.",
        body: (
            <>
                Keys light up here but don't reach your computer, including Windows, Tab, Ctrl, Alt, Shift and media keys.
                Mouse buttons and pointer movement still work. Other keyboards and mice work normally.{" "}
                <strong className="font-semibold">Hold {exitName} for 2 seconds to close the tester.</strong>
            </>
        ),
    };
}

/**
 * The note at the top of the matrix tester, always shown while it is open.
 * Three looks (A, B, C) for review, picked with ?testerNote=a|b|c.
 */
export const MatrixTesterNote: FC<MatrixTesterNoteProps> = ({ kind, exitName, onUpdateFirmware, variant }) => {
    const look = variant ?? testerNoteFromSearch(typeof window === "undefined" ? "" : window.location.search) ?? "a";
    const { heading, body } = words(kind, exitName, onUpdateFirmware);
    const warn = kind === "unsupported";
    const Icon = warn ? TriangleAlert : CirclePause;
    const common = { role: "status" as const, "aria-live": "polite" as const, "data-tester-note": kind, "data-tester-note-style": look };

    if (look === "b") {
        // B: a card, centered over the keys.
        return (
            <div {...common} className="mx-auto w-full max-w-2xl rounded-2xl border border-kb-gray-border bg-kb-popover px-5 py-4 text-kb-ink shadow-lg">
                <div className="flex items-start gap-3">
                    <Icon aria-hidden className={cn("mt-0.5 h-6 w-6 shrink-0", warn ? "text-kb-warn-ink" : "text-kb-primary")} />
                    <div className="min-w-0">
                        <h2 className="text-base font-semibold leading-snug">{heading}</h2>
                        <p className="mt-1 text-sm leading-relaxed text-kb-gray">{body}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (look === "c") {
        // C: open text with a large mark, no box, ruled off from the keys.
        return (
            <div {...common} className="mx-auto flex w-full max-w-3xl items-start gap-4 border-b border-kb-gray-border pb-4 text-kb-ink">
                <span
                    aria-hidden
                    className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                        warn ? "bg-kb-warn-bg text-kb-warn-ink" : "bg-kb-primary text-kb-surface"
                    )}
                >
                    <Icon className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                    <h2 className="text-lg font-semibold leading-snug">{heading}</h2>
                    <p className="mt-1 text-sm leading-relaxed">{body}</p>
                </div>
            </div>
        );
    }

    // A: a full-width band with an accent edge.
    return (
        <div
            {...common}
            className={cn(
                "w-full border-l-4 px-4 py-3 text-kb-ink",
                warn ? "border-kb-warn-ink bg-kb-warn-bg" : "border-kb-primary bg-kb-surface"
            )}
        >
            <div className="flex items-start gap-3">
                <Icon aria-hidden className={cn("mt-0.5 h-5 w-5 shrink-0", warn ? "text-kb-warn-ink" : "text-kb-primary")} />
                <div className="min-w-0">
                    <h2 className="text-sm font-semibold leading-snug">{heading}</h2>
                    <p className="mt-0.5 text-sm leading-relaxed">{body}</p>
                </div>
            </div>
        </div>
    );
};
