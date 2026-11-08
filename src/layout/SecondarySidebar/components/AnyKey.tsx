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
                    <DialogTitle>Enter a custom keycode</DialogTitle>
                    <DialogDescription>
                        Hex, decimal or QMK name, for example LCTL(KC_A)
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
            <Button variant="ghost" size="sm" onClick={() => setOpen(true)} data-testid="any-key-button" title="Custom keycode" aria-label="Custom keycode">
                Custom keycode
            </Button>
            {/* Mounted only while open, so a closed button needs no binding context. */}
            {open && <AnyKeyDialog open onOpenChange={setOpen} />}
        </>
    );
};

/** The tile that ends More keys. */
export const AnyKeyTile = () => {
    const [open, setOpen] = useState(false);
    return (
        <div className="flex flex-col gap-1">
            <span className="font-semibold text-base text-kb-ink">Custom keycode</span>
            <div className="flex flex-wrap gap-1">
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    data-testid="any-key-tile"
                    aria-label="Enter keycode"
                    className="group flex h-[60px] w-[60px] cursor-pointer select-none flex-col items-center justify-start overflow-hidden rounded-md border border-kb-key-border bg-kb-sidebar-base text-white transition-all duration-200 hover:ring-2 hover:ring-inset hover:ring-red-500"
                >
                    <span className="h-3 w-full bg-kb-sidebar-dark" aria-hidden="true" />
                    <span className="flex flex-1 items-center px-1 text-center text-[11px] font-medium uppercase leading-tight">Enter keycode</span>
                </button>
            </div>
            {/* Mounted only while open, so a closed button needs no binding context. */}
            {open && <AnyKeyDialog open onOpenChange={setOpen} />}
        </div>
    );
};
