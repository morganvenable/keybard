import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { placeOf } from "../../keymap/geometry";
import type { CharacterStats } from "../../state/progressView";
import { CharCap } from "../CharCap";
import { formatDate, formatPercent, formatSpeed, spokenPlace, spokenSpeed, targetName } from "../format";
import { ConfidenceBar } from "../StatCell";
import { CharOpener } from "./openers";
import type { ProgressP5 } from "./p5";

// Characters table (docs/practice/spec.md §5.8 item 7): sortable, one row per lesson character, default
// order confidence ascending. Each row has a button that opens P5. The cap keeps the layer face, since it
// identifies the character rather than showing heat.

type SortKey = "char" | "speed" | "best" | "accuracy" | "samples" | "confidence" | "last";

const COLUMNS: { key: SortKey | null; label: string; className?: string }[] = [
    { key: null, label: "" },
    { key: "char", label: "Character" },
    { key: null, label: "Path" },
    { key: "speed", label: "Speed", className: "text-right" },
    { key: "best", label: "Best", className: "text-right" },
    { key: "accuracy", label: "Accuracy", className: "text-right" },
    { key: "samples", label: "Samples", className: "text-right" },
    { key: "confidence", label: "Confidence" },
    { key: "last", label: "Last practiced" },
];

const value = (c: CharacterStats, key: SortKey): number | string => {
    switch (key) {
        case "char": return c.label;
        case "speed": return c.speed ?? -1;
        case "best": return c.best ?? -1;
        case "accuracy": return c.accuracy ?? -1;
        case "samples": return c.samples;
        case "confidence": return c.confidence ?? -1;
        case "last": return c.lastPracticed ?? -1;
    }
};

interface CharTableProps {
    rows: readonly CharacterStats[];
    /** P5 for each row (§5.7), with Drill this key. */
    p5: ProgressP5;
}

export function CharTable({ rows, p5 }: CharTableProps) {
    const { cols, unit } = p5;
    const [sort, setSort] = useState<{ key: SortKey; ascending: boolean }>({ key: "confidence", ascending: true });
    const [open, setOpen] = useState<number | null>(null);
    const sorted = useMemo(() => [...rows].sort((a, b) => {
        const x = value(a, sort.key), y = value(b, sort.key);
        const order = typeof x === "string" ? x.localeCompare(String(y)) : x - (y as number);
        return (sort.ascending ? order : -order) || a.label.localeCompare(b.label);
    }), [rows, sort]);

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" data-practice-chars>
                <thead>
                    <tr className="text-xs text-muted-foreground">
                        {COLUMNS.map((col, i) => {
                            const active = col.key && sort.key === col.key;
                            return (
                                <th key={i} scope="col" className={cn("px-2 py-2 font-medium text-left whitespace-nowrap", col.className)}
                                    aria-sort={active ? (sort.ascending ? "ascending" : "descending") : undefined}>
                                    {col.key ? (
                                        <button type="button" className="cursor-pointer hover:text-kb-ink rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                                            onClick={() => setSort((s) => ({ key: col.key!, ascending: s.key === col.key ? !s.ascending : true }))}>
                                            {col.label}{active ? (sort.ascending ? " ▲" : " ▼") : ""}
                                        </button>
                                    ) : col.label}
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {sorted.map((c) => {
                        const place = c.path ? placeOf(c.path.index, cols) : null;
                        const path = c.path ? `Layer ${c.path.layer} · ${targetName(c.path, cols)}` : "—";
                        return (
                            <tr key={c.codePoint} className={cn("h-9 border-t border-kb-gray-border", open === c.codePoint && "ring-2 ring-kb-select ring-inset")} data-char-row={c.label}>
                                <td className="px-2 py-1">
                                    <CharOpener p5={p5} codePoint={c.codePoint} open={open === c.codePoint} onOpenChange={(next) => setOpen((cur) => (next ? c.codePoint : cur === c.codePoint ? null : cur))}>
                                        <button type="button" className="block cursor-pointer rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                                            aria-label={`${c.label}, ${spokenSpeed(c.speed, unit)}, ${spokenPlace(place)}${(c.confidence ?? 0) >= 1 ? ", at target" : ""}`}>
                                            <CharCap codePoint={c.codePoint} layerColor={p5.charColor(c.codePoint)} look={c.calibrated ? "included" : "uncalibrated"} />
                                        </button>
                                    </CharOpener>
                                </td>
                                <td className="px-2 py-1 font-medium">{c.label}</td>
                                <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">{path}</td>
                                <td className="px-2 py-1 text-right tabular-nums">{formatSpeed(c.speed, unit)}</td>
                                <td className="px-2 py-1 text-right tabular-nums">{formatSpeed(c.best, unit)}</td>
                                <td className="px-2 py-1 text-right tabular-nums">{c.accuracy != null ? `${formatPercent(c.accuracy)}%` : "—"}</td>
                                <td className="px-2 py-1 text-right tabular-nums">{c.samples}</td>
                                <td className="px-2 py-1 w-28"><ConfidenceBar value={c.confidence} /></td>
                                <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">{c.lastPracticed ? formatDate(c.lastPracticed) : "—"}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

export default CharTable;
