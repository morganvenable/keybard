import { Button } from "@/components/ui/button";
import { useKeyboard } from "@/contexts/KeyboardContext";
import { usbInstance } from "@/services/usb.service";
import { BALL_DIAG_REQUEST, ballDiagLines, parseBallDiag } from "@/utils/ball-diag";
import { useCallback, useEffect, useState } from "react";

/**
 * Trackball diagnostics test build: the counters the ball-diag firmware (x4.6.4-balldiag) keeps,
 * as plain lines to paste into the ticket while the ball is dead. Read on demand.
 */
export default function TrackballDiagnostics() {
    const { isConnected, connectionSessionId } = useKeyboard();
    const [lines, setLines] = useState<string[] | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [busy, setBusy] = useState(false);

    const refresh = useCallback(async () => {
        setBusy(true);
        setMessage(null);
        try {
            const reply = await usbInstance.sendSvil(0x2c, BALL_DIAG_REQUEST, { uint8: true }) as Uint8Array;
            const report = parseBallDiag(reply);
            if (report) setLines(ballDiagLines(report));
            else setMessage("This keyboard's firmware has no trackball diagnostics. Install x4.6.4-balldiag from Firmware.");
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
            await navigator.clipboard.writeText(["Trackball diagnostics", ...lines].join("\n"));
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            setMessage("Could not copy. Select the lines and copy them instead.");
        }
    };

    return (
        <div className="flex flex-col p-3 gap-3 panel-layer-item" data-testid="trackball-diagnostics">
            <div className="flex flex-col gap-1">
                <span className="text-md text-left">Trackball diagnostics</span>
                <span className="text-xs text-muted-foreground">
                    When a trackball stops working, press Refresh, then Copy, and paste the lines into your ticket.
                </span>
            </div>
            <div className="flex flex-row gap-2">
                <Button size="sm" variant="outline" disabled={busy || !isConnected} onClick={refresh}>Refresh</Button>
                <Button size="sm" disabled={!lines} onClick={copy}>{copied ? "Copied" : "Copy"}</Button>
            </div>
            {message && <p className="text-sm text-muted-foreground" role="status">{message}</p>}
            {lines && (
                <ul className="flex flex-col gap-1 text-sm font-mono select-text" data-testid="ball-diag-lines">
                    {lines.map((l) => <li key={l}>{l}</li>)}
                </ul>
            )}
        </div>
    );
}
