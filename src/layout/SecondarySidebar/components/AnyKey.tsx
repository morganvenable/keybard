import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useKeyBinding } from "@/contexts/KeyBindingContext";
import { resolveAnyKey } from "@/lib/anyKey";

interface DialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/** A small field that takes a name, an expression or a number and assigns it to the selected key. */
export const AnyKeyDialog = ({ open, onOpenChange }: DialogProps) => {
    const { assignKeycode } = useKeyBinding();
    const [text, setText] = useState("");
    const result = resolveAnyKey(text);
    const canAssign = result.status === "known" || result.status === "unknown";

    const close = (next: boolean) => {
        if (!next) setText("");
        onOpenChange(next);
    };
    const assign = () => {
        if (result.status !== "known" && result.status !== "unknown") return;
        assignKeycode(result.code);
        close(false);
    };

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent className="max-w-sm" data-testid="any-key-dialog">
                <DialogHeader>
                    <DialogTitle>Any key</DialogTitle>
                    <DialogDescription>
                        A keycode name, an expression like LCTL(KC_A) or MO(3), or a number in hex or decimal.
                    </DialogDescription>
                </DialogHeader>
                <input
                    autoFocus
                    aria-label="Keycode"
                    data-testid="any-key-input"
                    className="w-full rounded-md border border-kb-gray-border bg-transparent px-3 py-2 font-mono text-kb-ink"
                    placeholder="QK_BOOT"
                    autoComplete="off"
                    spellCheck={false}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && canAssign) assign();
                    }}
                />
                <p
                    role="status"
                    data-testid="any-key-result"
                    data-status={result.status}
                    className={
                        "min-h-5 text-sm text-kb-ink" +
                        (result.status === "unknown" || result.status === "invalid" ? " border-l-4 border-kb-orange pl-2" : "")
                    }
                >
                    {result.status === "empty" ? "" : result.message}
                </p>
                <DialogFooter>
                    <Button variant="outline" onClick={() => close(false)}>
                        Cancel
                    </Button>
                    <Button disabled={!canAssign} onClick={assign} data-testid="any-key-assign">
                        {result.status === "unknown" ? "Assign anyway" : "Assign"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

/** The quiet button in a picker's header. */
export const AnyKeyButton = () => {
    const [open, setOpen] = useState(false);
    return (
        <>
            <Button variant="ghost" size="sm" onClick={() => setOpen(true)} data-testid="any-key-button">
                Any key
            </Button>
            <AnyKeyDialog open={open} onOpenChange={setOpen} />
        </>
    );
};

/** The tile that ends More keys. */
export const AnyKeyTile = () => {
    const [open, setOpen] = useState(false);
    return (
        <div className="flex flex-col gap-1">
            <span className="font-semibold text-base text-kb-ink">Any keycode</span>
            <div className="flex flex-wrap gap-1">
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    data-testid="any-key-tile"
                    className="h-[60px] w-[60px] rounded-md border border-kb-gray-border bg-kb-sidebar-dark text-xs text-kb-ink"
                >
                    Any key
                </button>
            </div>
            <AnyKeyDialog open={open} onOpenChange={setOpen} />
        </div>
    );
};
