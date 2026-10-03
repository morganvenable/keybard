import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVial } from "@/contexts/VialContext";
import { identityService, IdentityInfo, IdentityStatus, NAME_MAX_CHARS, nameLength, nameProblem, SerialSource } from "@/services/identity.service";
import { useEffect, useState } from "react";

const STATUS_TEXT: Record<number, string> = {
    [IdentityStatus.Invalid]: "The keyboard didn't accept that name.",
    [IdentityStatus.Unavailable]: "This keyboard has nowhere to keep a name.",
    [IdentityStatus.WriteFailed]: "The keyboard couldn't save the name. Try again.",
};

/**
 * The board's own name and serial, kept on the keyboard so they survive
 * firmware updates. Shown only when the firmware supports it.
 */
export default function BoardIdentitySection() {
    const { isConnected } = useVial();
    const [info, setInfo] = useState<IdentityInfo | null>(null);
    const [draft, setDraft] = useState("");
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [needsRestart, setNeedsRestart] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setInfo(null);
        if (!isConnected) return;
        identityService.getInfo().then((i) => {
            if (cancelled) return;
            setInfo(i);
            setDraft(i?.name ?? "");
        });
        return () => {
            cancelled = true;
        };
    }, [isConnected]);

    if (!info) return null;

    const dirty = draft !== info.name;
    const problem = nameProblem(draft, info.nameMaxBytes);

    const save = async () => {
        setBusy(true);
        setMessage(null);
        const status = await identityService.setName(draft);
        setBusy(false);
        if (status === IdentityStatus.Ok) {
            setInfo({ ...info, name: draft });
            setNeedsRestart(true);
        } else {
            setMessage(STATUS_TEXT[status] ?? "The keyboard didn't accept that name.");
        }
    };

    const restart = async () => {
        setBusy(true);
        await identityService.restart();
        setNeedsRestart(false);
        setBusy(false);
    };

    return (
        <div className="flex flex-col p-3 gap-3 panel-layer-item" data-testid="board-identity">
            <div className="flex flex-col gap-1">
                <span className="text-md text-left">Board name</span>
                <span className="text-xs text-muted-foreground">
                    Shown by your computer and browser. Kept on the keyboard, so it survives firmware updates.
                </span>
            </div>
            {info.available ? (
                <>
                    <div className="flex flex-row items-center gap-2">
                        <Input
                            aria-label="Board name"
                            value={draft}
                            placeholder="Svalboard"
                            onChange={(e) => {
                                setDraft(e.target.value);
                                setMessage(null);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && dirty && !problem && !busy) save();
                            }}
                            className={dirty ? "border-amber-500" : undefined}
                        />
                        <Button size="sm" disabled={!dirty || !!problem || busy} onClick={save}>
                            Save
                        </Button>
                    </div>
                    <div className="flex flex-row justify-between text-xs text-muted-foreground">
                        <span className={problem ? "text-red-600" : undefined}>{problem ?? message ?? (dirty ? "Not saved yet" : "")}</span>
                        <span>
                            {nameLength(draft)}/{NAME_MAX_CHARS}
                        </span>
                    </div>
                    {needsRestart && (
                        <div className="flex flex-row items-center justify-between gap-2 text-xs">
                            <span>Saved. Restart the keyboard for your computer to show the new name.</span>
                            <Button size="sm" variant="outline" disabled={busy} onClick={restart}>
                                Restart keyboard
                            </Button>
                        </div>
                    )}
                </>
            ) : (
                <span className="text-xs text-muted-foreground">This keyboard's flash has no room for a name.</span>
            )}
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                <span>
                    Serial <span className="font-mono">{info.serial}</span>
                </span>
                {info.serialSource === SerialSource.Random && <span>Generated on this keyboard (its flash chip has no ID).</span>}
            </div>
        </div>
    );
}
