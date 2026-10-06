import { useEffect, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import type { CustomUIMenuItem } from "@/types/keyboard.types";

interface RangeControlProps {
    item: CustomUIMenuItem;
    value: number;
    onChange: (value: number) => void;
    compact?: boolean;
}

export const RangeControl: React.FC<RangeControlProps> = ({ item, value, onChange, compact = false }) => {
    // Options format: [min, max] or [min, max, step]
    const options = item.options as number[] | undefined;
    const min = options?.[0] ?? 0;
    const max = options?.[1] ?? 255;
    const step = options?.[2] ?? 1;

    const [draft, setDraft] = useState(String(value));
    useEffect(() => { setDraft(String(value)); }, [value]);
    const commit = (raw: string) => {
        if (!raw.trim() || !Number.isFinite(Number(raw))) { setDraft(String(value)); return; }
        const next = Math.max(min, Math.min(max, Math.round(Number(raw) / step) * step));
        setDraft(String(next));
        if (next !== value) onChange(next);
    };

    if (compact) {
        // Compact: label on top, slider + input inline below
        return (
            <div className="flex flex-col gap-0.5 py-0.5">
                <span title={item.description} className="text-xs">{item.label}</span>
                <div className="flex flex-row items-center gap-1.5">
                    <Slider
                        aria-label={item.label}
                        aria-description={item.description}
                        value={[Number(draft) || min]}
                        onValueChange={(values) => setDraft(String(values[0]))}
                        onValueCommit={(values) => commit(String(values[0]))}
                        min={min}
                        max={max}
                        step={step}
                        className="w-20"
                    />
                    <Input
                        type="number"
                        aria-label={item.label}
                        aria-description={item.description}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={(e) => commit(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") { e.currentTarget.value = String(value); setDraft(String(value)); e.currentTarget.blur(); }
                            if (e.key === "Enter") e.currentTarget.blur();
                        }}
                        className="w-14 h-6 text-xs text-right px-1"
                        min={min}
                        max={max}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2 p-2 panel-layer-item">
            <span title={item.description} className="text-md">{item.label}</span>
            <div className="flex flex-row items-center gap-3">
                <Slider
                        aria-label={item.label}
                        aria-description={item.description}
                    value={[Number(draft) || min]}
                    onValueChange={(values) => setDraft(String(values[0]))}
                        onValueCommit={(values) => commit(String(values[0]))}
                    min={min}
                    max={max}
                    step={step}
                    className="flex-grow"
                />
                <Input
                    type="number"
                        aria-label={item.label}
                        aria-description={item.description}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                        onBlur={(e) => commit(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") { e.currentTarget.value = String(value); setDraft(String(value)); e.currentTarget.blur(); }
                            if (e.key === "Enter") e.currentTarget.blur();
                        }}
                    className="w-20 text-right"
                    min={min}
                    max={max}
                />
            </div>
        </div>
    );
};
