// Which half is which, on the one-image firmware: the warning and the fix. Shown on the
// Firmware page, in the editor's banner, before an update (the sheet), and in the update
// when a half came back without a side. A proposal: the wording and placement are
// for review.

import { AlertTriangle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { oppositeSide, type Side } from "@/services/side";
import type { HalfRole, SideAssessment, SideWrite } from "@/services/side-decision";
import type { SideAsk } from "@/services/updater/flow";
import { sameSideFix, writesForAnswer } from "@/services/side-decision";

const cap = (s: Side) => (s === "left" ? "Left" : "Right");

/** The flow's question as an assessment, for SideFix. */
export function assessmentFromAsk(ask: SideAsk): SideAssessment {
    if (ask.reason === "same" && (ask.usb === "left" || ask.usb === "right")) return { kind: "same", side: ask.usb };
    const halves: HalfRole[] = [];
    if (ask.usb === "unknown" || ask.usb === null) halves.push("usb");
    if (ask.other === "unknown") halves.push("other");
    if (ask.other === null && (ask.usb === "unknown" || ask.usb === null)) return { kind: "alone", usb: "unknown" };
    return { kind: "unknown", halves, usb: ask.usb ?? "unknown", other: ask.other, guess: ask.suggested ? { usb: ask.suggested } : {} };
}

/** The line that says what's wrong, or null when nothing is. */
export function sideProblem(a: SideAssessment): string | null {
    if (a.kind === "same") return `Both halves are set up as the ${a.side} half, so neither half types.`;
    if (a.kind === "alone" && a.usb === "unknown") return "This half doesn't know which side it is, so it doesn't type.";
    if (a.kind !== "unknown") return null;
    const usb = a.halves.includes("usb");
    const other = a.halves.includes("other");
    if (usb && other) return "Neither half knows which side it is yet, so neither half types.";
    if (usb) return "The half plugged into your computer doesn't know which side it is, so neither half types.";
    if (other) return "The half on the split cable doesn't know which side it is, so neither half types.";
    return "Keybard can't tell which half is which, so neither half types.";
}

export interface SideFixProps {
    sides: SideAssessment;
    /** Send these SETs (the other half first). */
    onApply: (writes: SideWrite[]) => void;
    /** The side to offer first, when Keybard can tell. */
    suggested?: Side | null;
    busy?: boolean;
    /** Why the last write didn't take, in plain words. */
    note?: string | null;
    /** No heading: the dialog or the banner has its own. */
    bare?: boolean;
}

export function SideFix({ sides, onApply, suggested, busy, note, bare }: SideFixProps) {
    const problem = sideProblem(sides);
    if (!problem) return null;
    const pick = suggested ?? (sides.kind === "unknown" ? sides.guess.usb ?? null : null);
    return (
        <div className="flex flex-col gap-3" data-testid="side-fix" data-sides={sides.kind} aria-busy={busy || undefined}>
            {!bare && (
                <p className="flex items-center gap-2 text-sm font-semibold text-kb-orange">
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                    Set which half is which
                </p>
            )}
            <p className="text-sm text-kb-ink">{problem}</p>
            {sides.kind === "same" ? (
                <div className="flex flex-col items-start gap-2">
                    <Button size="sm" variant="kb-primary" disabled={busy} data-side-action="fix-other" onClick={() => onApply([sameSideFix(sides.side)])}>
                        Make the other half the {oppositeSide(sides.side)} half
                    </Button>
                    <button
                        type="button"
                        className="text-left text-sm text-kb-primary underline disabled:opacity-50"
                        disabled={busy}
                        data-side-action="fix-usb"
                        onClick={() => onApply(writesForAnswer(sides, oppositeSide(sides.side)))}
                    >
                        No, the half plugged into your computer is the {oppositeSide(sides.side)} half
                    </button>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium text-kb-ink">Which half is plugged into your computer?</p>
                    <div className="flex flex-wrap gap-2">
                        {(["left", "right"] as Side[]).map((s) => (
                            <Button
                                key={s}
                                size="sm"
                                variant={pick === s ? "kb-primary" : "outline"}
                                disabled={busy}
                                data-side-answer={s}
                                onClick={() => onApply(writesForAnswer(sides, s))}
                            >
                                {cap(s)} half
                            </Button>
                        ))}
                    </div>
                </div>
            )}
            {busy && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />Setting the side. The half restarts.
                </p>
            )}
            {note && <p role="alert" className="text-sm text-kb-red" data-testid="side-note">{note}</p>}
        </div>
    );
}
