import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useKeyboard } from "@/contexts/KeyboardContext";
import { keyboardService } from "@/services/keyboard.service";
import { statusGroups, statusText, type BoardStatus } from "@/services/status-report";
import { RowText } from "./SettingRow";

export const BOARD_STATUS_LABEL = "Board status";
export const BOARD_STATUS_DESCRIPTION = "What the board runs now. Copy it to share in a support request.";
export const BOARD_STATUS_READ_FAILED = "Couldn't read the board status. Try Refresh.";
export const BOARD_STATUS_COPY_FAILED = "Couldn't copy. Select the rows and copy them instead.";

/**
 * The report the Output Status key types (Sval STATUS_REPORT, 0x3F), read from
 * the board and shown as rows, so it reads right on any keyboard layout. Read
 * when shown and on Refresh; Copy writes it as plain text. Shown only on
 * firmware that has the command.
 */
const BoardStatusSection: React.FC<{ highlight?: (text: string) => React.ReactNode }> = ({ highlight }) => {
    const { keyboard, isConnected } = useKeyboard();
    const supported = isConnected && keyboardService.hasStatusReport(keyboard);
    const [status, setStatus] = useState<BoardStatus | null>(null);
    const [reading, setReading] = useState(false);
    const [failed, setFailed] = useState(false);
    const [copied, setCopied] = useState<"done" | "failed" | null>(null);
    // Bumped for every board and every read: a reply for an earlier one is dropped.
    const generation = useRef(0);

    const read = useCallback(async () => {
        const mine = ++generation.current;
        setReading(true);
        setFailed(false);
        const next = await keyboardService.readStatusReport().catch(() => null);
        if (generation.current !== mine) return;
        setReading(false);
        if (next) setStatus(next);
        setFailed(next === null);
    }, []);

    // Another board (or none): drop the old report. The same board with a
    // setting changed (a new keyboard object): read again, keeping the rows
    // shown until the new ones arrive, so the card doesn't collapse.
    const shownFor = useRef<string | null>(null);
    useEffect(() => {
        const board = supported ? keyboard?.kbid ?? "" : null;
        if (board !== shownFor.current) {
            shownFor.current = board;
            setStatus(null);
            setCopied(null);
        }
        if (supported) read();
        return () => { generation.current++; };
    }, [supported, keyboard, read]);

    const copy = async () => {
        if (!status) return;
        try {
            await navigator.clipboard.writeText(statusText(status));
            setCopied("done");
            window.setTimeout(() => setCopied(null), 1500);
        } catch {
            setCopied("failed");
        }
    };

    if (!supported) return null;
    return (
        <div data-board-status className="flex flex-col gap-2 px-3 py-2.5">
            <div className="flex flex-row flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <RowText label={BOARD_STATUS_LABEL} description={BOARD_STATUS_DESCRIPTION} highlight={highlight} />
                <div className="flex flex-row gap-2 shrink-0">
                    <Button size="sm" variant="outline" disabled={reading} onClick={read} data-testid="board-status-refresh">
                        {reading ? "Reading…" : "Refresh"}
                    </Button>
                    <Button size="sm" variant="outline" disabled={!status} onClick={copy} data-testid="board-status-copy">
                        {copied === "done" ? "Copied" : "Copy"}
                    </Button>
                </div>
            </div>
            {failed && <p role="alert" className="text-xs text-kb-warn-ink">{BOARD_STATUS_READ_FAILED}</p>}
            {copied === "failed" && <p role="alert" className="text-xs text-kb-warn-ink">{BOARD_STATUS_COPY_FAILED}</p>}
            {status && (
                <div className="flex flex-col gap-3 text-sm" data-testid="board-status-rows">
                    {statusGroups(status).map((group) => (
                        <section key={group.title} aria-label={group.title} className="flex flex-col gap-1">
                            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.title}</h4>
                            <dl className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-3 gap-y-1">
                                {group.rows.map((row) => (
                                    <React.Fragment key={row.label}>
                                        <dt className="text-muted-foreground">{row.label}</dt>
                                        <dd className="text-kb-ink break-words">{row.value}</dd>
                                    </React.Fragment>
                                ))}
                            </dl>
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
};

export default BoardStatusSection;
