import type { FC } from "react";
import { CirclePause, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

export type TesterNoteKind = "paused" | "unsupported";

export interface MatrixTesterNoteProps {
    kind: TesterNoteKind;
    /** How the note names the exit key ("Esc", or the fallback pair). */
    exitName: string;
    /** Opens Keybard's firmware update (older firmware only). */
    onUpdateFirmware?: () => void;
}

/**
 * The note at the top of the matrix tester, always shown while it is open: two short
 * lines while typing is paused, one line when the firmware can't pause it.
 */
export const MatrixTesterNote: FC<MatrixTesterNoteProps> = ({ kind, exitName, onUpdateFirmware }) => {
    const warn = kind === "unsupported";
    const Icon = warn ? TriangleAlert : CirclePause;
    return (
        <div
            role="status"
            aria-live="polite"
            data-tester-note={kind}
            className={cn(
                "w-full border-l-4 px-4 py-3 text-sm text-kb-ink",
                warn ? "border-kb-warn-ink bg-kb-warn-bg" : "border-kb-primary bg-kb-surface"
            )}
        >
            <div className="flex items-start gap-3">
                <Icon aria-hidden className={cn("mt-0.5 h-5 w-5 shrink-0", warn ? "text-kb-warn-ink" : "text-kb-primary")} />
                {warn ? (
                    <p className="min-w-0 leading-snug" data-tester-note-line="">
                        Your firmware can't pause typing.{" "}
                        <button
                            type="button"
                            onClick={onUpdateFirmware}
                            className="cursor-pointer font-medium text-kb-primary underline underline-offset-2"
                            data-tester-update-firmware=""
                        >
                            Update
                        </button>{" "}
                        to block keys while testing.
                    </p>
                ) : (
                    <div className="min-w-0 leading-snug">
                        <p className="font-semibold" data-tester-note-line="">Typing paused while testing</p>
                        <p data-tester-note-line="">Leave this screen to type again · Hold {exitName} 2 s to leave</p>
                    </div>
                )}
            </div>
        </div>
    );
};
