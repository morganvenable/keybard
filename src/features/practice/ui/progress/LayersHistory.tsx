import { useState } from "react";

import { PILL_QUIET } from "@/components/shared/pills";
import { cn } from "@/lib/utils";
import type { KeyboardInfo } from "@/types/keyboard.types";
import { drillGroupLabel } from "../../lessons/scope";
import type { HistoryRow, LayerRow } from "../../state/progressAggregates";
import { historyPage, layerSeries } from "../../state/progressAggregates";
import type { DrillGroup } from "../../state/settings";
import type { StoredResult } from "../../store/db";
import { formatDateTime, formatPercent, formatSpeed, layerColorHex, layerName, lessonTypeLabel } from "../format";
import { InputDot, PILL_TEXT } from "../InputStatus";
import { GroupOpener, OPENER_SELECTED } from "./openers";
import type { ProgressP5 } from "./p5";

// G1 Layers and History (docs/practice/spec.md §5.8 items 6 and 8). Layers: one row per layer with samples
// (a pill with the layer's color dot and name, characters, speed, accuracy, reach (live) and share of
// keystrokes); the pill opens P5's aggregate. History: the lessons of the period, 50 a page, newest first,
// with quiet Newer / Older pills.

const TH = "px-2 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap";
const TD = "px-2 py-1 whitespace-nowrap";

export function LayersTable({ rows, board, p5 }: { rows: readonly LayerRow[]; board: Pick<KeyboardInfo, "cosmetic"> | null | undefined; p5: ProgressP5 }) {
    const [open, setOpen] = useState<number | null>(null);
    const unit = p5.unit;
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" data-practice-layers>
                <thead>
                    <tr>
                        <th scope="col" className={TH}>Layer</th>
                        <th scope="col" className={cn(TH, "text-right")}>Characters</th>
                        <th scope="col" className={cn(TH, "text-right")}>Speed</th>
                        <th scope="col" className={cn(TH, "text-right")}>Accuracy</th>
                        <th scope="col" className={cn(TH, "text-right")}>Reach</th>
                        <th scope="col" className={cn(TH, "text-right")}>Share</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => {
                        const name = layerName(board, row.layer);
                        const series = layerSeries(p5.records, row.layer);
                        const group = {
                            name, chars: row.chars, speed: row.cpm, best: series.length ? Math.max(...series) : null, accuracy: row.accuracy,
                            samples: row.hits, confidence: row.cpm != null ? row.cpm / p5.targetSpeed : null, series,
                        };
                        return (
                            <tr key={row.layer} className="h-9 border-t border-kb-gray-border" data-layer-row={row.layer}>
                                <td className={TD}>
                                    <GroupOpener p5={p5} group={group} open={open === row.layer} onOpenChange={(next) => setOpen((cur) => (next ? row.layer : cur === row.layer ? null : cur))}>
                                        <button type="button" aria-label={`${name}, ${formatSpeed(row.cpm, unit)} ${unit}, ${formatPercent(row.accuracy)} percent`}
                                            className={cn("inline-flex items-center gap-1.5 rounded-full bg-kb-gray-medium px-2.5 py-0.5 text-[13px] text-kb-ink cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2", open === row.layer && OPENER_SELECTED)}>
                                            <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: layerColorHex(board, row.layer) }} />
                                            {name}
                                        </button>
                                    </GroupOpener>
                                </td>
                                <td className={cn(TD, "text-right tabular-nums")}>{row.characters}</td>
                                <td className={cn(TD, "text-right tabular-nums")}>{formatSpeed(row.cpm, unit)} {row.cpm != null ? unit : ""}</td>
                                <td className={cn(TD, "text-right tabular-nums")}>{row.accuracy != null ? `${formatPercent(row.accuracy, 1)}%` : "—"}</td>
                                <td className={cn(TD, "text-right tabular-nums", row.reachMs == null && "text-muted-foreground")}>{row.reachMs != null ? `${Math.round(row.reachMs)} ms` : "—"}</td>
                                <td className={cn(TD, "text-right tabular-nums")}>{formatPercent(row.share, 1)}%</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

/** "Guided", "Drill · Layer 1 · Symbols", "Drill · L-middle · N" (§5.8 History Type). */
export function historyTypeText(row: Pick<HistoryRow, "type" | "scope">, board: Pick<KeyboardInfo, "cosmetic"> | null | undefined): string {
    const type = lessonTypeLabel(row.type);
    if (row.type !== "drill") return type;
    const s = row.scope;
    if (s.group === "keys") return `${type} · Chosen keys`;
    const parts = [s.layer != null ? layerName(board, s.layer) : null, s.group && s.group !== "all" ? drillGroupLabel(s.group as DrillGroup) ?? s.group : null];
    const named = parts.filter(Boolean);
    return named.length ? `${type} · ${named.join(" · ")}` : type;
}

export function HistoryTable({ records, board, unit }: { records: readonly StoredResult[]; board: Pick<KeyboardInfo, "cosmetic"> | null | undefined; unit: ProgressP5["unit"] }) {
    const [page, setPage] = useState(0);
    const { rows, pages } = historyPage(records, page);
    const current = Math.min(page, pages - 1);
    return (
        <div className="flex flex-col gap-3" data-practice-history>
            <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr>
                            <th scope="col" className={TH}>Date</th>
                            <th scope="col" className={TH}>Type</th>
                            <th scope="col" className={cn(TH, "text-right")}>Speed</th>
                            <th scope="col" className={cn(TH, "text-right")}>Accuracy</th>
                            <th scope="col" className={cn(TH, "text-right")}>Length</th>
                            <th scope="col" className={TH}>Input</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.id} className="h-9 border-t border-kb-gray-border" data-history-row={row.id}>
                                <td className={TD}>{formatDateTime(row.ts)}</td>
                                <td className={TD}>{historyTypeText(row, board)}</td>
                                <td className={cn(TD, "text-right tabular-nums")}>{formatSpeed(row.speed, unit)} {unit}</td>
                                <td className={cn(TD, "text-right tabular-nums")}>{formatPercent(row.accuracy, 1)}%</td>
                                <td className={cn(TD, "text-right tabular-nums")}>{row.length} chars</td>
                                <td className={TD}>
                                    <span className="inline-flex items-center gap-2">
                                        <InputDot state={row.src === "keymap" ? "keymap" : "usb"} />
                                        {row.src === "host" ? "Live · Host" : PILL_TEXT[row.src === "usb" ? "usb" : "keymap"]}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {pages > 1 && (
                <div className="flex gap-2">
                    <button type="button" className={cn(PILL_QUIET, "disabled:opacity-50 disabled:cursor-default")} disabled={current === 0} onClick={() => setPage(current - 1)}>Newer</button>
                    <button type="button" className={cn(PILL_QUIET, "disabled:opacity-50 disabled:cursor-default")} disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Older</button>
                </div>
            )}
        </div>
    );
}
