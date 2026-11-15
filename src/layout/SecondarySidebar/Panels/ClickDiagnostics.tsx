import { Button } from "@/components/ui/button";
import { useKeyboard } from "@/contexts/KeyboardContext";
import { usbInstance } from "@/services/usb.service";
import { clickDiagLines, readClickDiag } from "@/utils/click-diag";
import { useCallback, useEffect, useState } from "react";

/**
 * Click diagnostics test build: what the x4.6.6-clickdiag firmware recorded on both halves
 * (touchpad touches and gestures, mouse buttons sent, layer changes), newest first, to paste
 * into the ticket right after a phantom right click. Read on demand.
 */
export default function ClickDiagnostics() {
    const { isConnected, connectionSessionId } = useKeyboard();
    const [lines, setLines] = useState<string[] | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [busy, setBusy] = useState(false);

    const refresh = useCallback(async () => {
        setBusy(true);
        setMessage(null);
        try {
            const q = (args: number[]) => usbInstance.sendSvil(0x2c, args, { uint8: true }) as Promise<Uint8Array>;
            const { halves, supported } = await readClickDiag(q);
            if (!supported) {
                setLines(null);
                setMessage("This keyboard's firmware has no click diagnostics. Install x4.6.6-clickdiag from Firmware.");
            } else {
                const out = clickDiagLines(halves);
                if (halves.length < 2) out.unshift("The other half did not answer (split link down?).");
                setLines(out);
            }
        } catch {
            setMessage("Could not read the keyboard. Check the connection and press Refresh.");
        } finally {
            setBusy(false);
        }
    }, []);

    useEffect(() => {
        setLines(null);
        if (isConnected) void refresh();
    }, [isConnected, connectionSessionId, refresh]);

    const copy = async () => {
        if (!lines) return;
        try {
            await navigator.clipboard.writeText(["Click diagnostics (x4.6.6-clickdiag), newest first", ...lines].join("\n"));
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            setMessage("Could not copy. Select the lines and copy them instead.");
        }
    };

    return (
        <div className="flex flex-col p-3 gap-3 panel-layer-item" data-testid="click-diagnostics">
            <div className="flex flex-col gap-1">
                <span className="text-md text-left">Click diagnostics</span>
                <span className="text-xs text-muted-foreground">
                    Right after an unexpected right click or context menu, press Refresh, then Copy, and paste the lines into your ticket.
                </span>
            </div>
            <div className="flex flex-row gap-2">
                <Button size="sm" variant="outline" disabled={busy || !isConnected} onClick={refresh}>{busy ? "Reading…" : "Refresh"}</Button>
                <Button size="sm" disabled={!lines || busy} onClick={copy}>{copied ? "Copied" : "Copy"}</Button>
            </div>
            {message && <p className="text-sm text-muted-foreground" role="status">{message}</p>}
            {lines && (
                <ul className="flex flex-col gap-1 text-xs font-mono select-text max-h-[60vh] overflow-auto" data-testid="click-diag-lines">
                    {lines.map((l, i) => <li key={i}>{l}</li>)}
                </ul>
            )}
        </div>
    );
}
