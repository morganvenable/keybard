import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import type { CustomUIMenuItem } from "@/types/keyboard.types";
import { NOT_READ } from "./NotRead";

/** Present a rate limit while preserving the firmware's microsecond interval. */
export function ScanRateControl({ item, value, onChange, compact = false }: {
    /** value undefined: not read from the board (nothing is selected; choosing a rate writes it). */
    item: CustomUIMenuItem; value: number | undefined; onChange: (value: number) => void; compact?: boolean;
}) {
    const rate = (period: number) => period ? Math.round(1_000_000 / period * 100) / 100 : 0;
    const cancelEdit = useRef(false);
    const selectRef = useRef<HTMLSelectElement>(null);
    const [custom, setCustom] = useState(false);
    const unread = value === undefined;
    const [draft, setDraft] = useState(unread ? "" : String(rate(value)));
    const [error, setError] = useState<string | null>(null);
    useEffect(() => { setDraft(value === undefined ? "" : String(rate(value))); setError(null); }, [value]);
    const maxPeriod = Number(item.options?.[1]) || 20000;
    const periods = [0, 20000, 8000, 4000, 2000, 1000, 500, 250, 125].filter(p => p <= maxPeriod);
    if (value !== undefined && !periods.includes(value)) periods.push(value);
    const commit = () => {
        if (cancelEdit.current) return;
        const hz = Number(draft);
        if (!draft.trim() || !Number.isFinite(hz) || hz < 1_000_000 / maxPeriod || hz > 1_000_000) {
            setError(`Enter a rate from ${Math.ceil(1_000_000 / maxPeriod)} to 1000000 Hz, or choose Unlimited.`);
            return;
        }
        const period = Math.round(1_000_000 / hz);
        setError(null); setCustom(false);
        if (period !== value) onChange(period);
    };
    return <div className={compact ? "py-0.5" : "p-2 panel-layer-item"}>
        <div className="flex items-center justify-between gap-2">
            <span title={item.description} className={compact ? "text-xs" : "text-md"}>{item.label}</span>
            {custom ? <div className="flex items-center gap-1">
                <Input type="number" className="w-24" aria-label="Custom key scan rate" aria-description={item.description} aria-invalid={!!error} autoFocus
                    value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit}
                    onKeyDown={e => {
                        if (e.key === "Enter" || e.key === "Escape") {
                            e.preventDefault(); e.stopPropagation();
                            if (e.key === "Enter") commit();
                            else { cancelEdit.current = true; setCustom(false); setError(null); }
                            requestAnimationFrame(() => selectRef.current?.focus());
                        }
                    }} />
                <span className="text-xs">Hz</span>
            </div> : <select ref={selectRef} aria-label={item.label} aria-description={item.description} title={item.description} value={unread ? "" : String(value)}
                className="rounded-md border dark:border-input bg-kb-surface px-2 py-1.5 text-sm" onChange={e => {
                    if (e.target.value === "custom") { cancelEdit.current = false; setDraft(String((value !== undefined && rate(value)) || 1000)); setCustom(true); }
                    else onChange(Number(e.target.value));
                }}>
                {unread && <option value="" disabled>{NOT_READ}</option>}
                {periods.map(period => <option key={period} value={period}>{period === 0 ? "Unlimited" : `${rate(period)} Hz`}</option>)}
                <option value="custom">Custom rate…</option>
            </select>}
        </div>
        {error && <p role="alert" className="mt-1 text-xs text-red-700 dark:text-red-400">{error}</p>}
    </div>;
}
