import { useEffect, useState, type ReactNode } from "react";

import OnOffToggle from "@/components/ui/OnOffToggle";
import { NotReadNote } from "@/components/CustomUI/controls/NotRead";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

/**
 * The rows of the Pointing Devices panel. Every row is a label with one plain line under
 * it on the left and its control on the right; a slider row puts the value beside
 * the label and the slider below. A value the board didn't give says "Not read"
 * and never shows a stand-in.
 */
const ROW = "flex flex-col gap-1.5 rounded-md px-3 py-2 panel-layer-item";

export function RowLabel({ label, hint, id }: { label: string; hint?: ReactNode; id?: string }) {
    return (
        <div className="flex min-w-0 flex-col gap-0.5">
            <span id={id} className="text-sm text-kb-ink">{label}</span>
            {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
    );
}

/**
 * A row that has no effect right now: its value stays in sight, grayed, and the control takes
 * no input. `describedBy` names the line that says why (aria-describedby).
 */
export interface DisabledProps {
    disabled?: boolean;
    describedBy?: string;
}
const DISABLED_ROW = "opacity-60";

export function ToggleRow({ label, hint, value, onChange, disabled, describedBy }: { label: string; hint?: ReactNode; value: number | undefined; onChange: (v: number) => void } & DisabledProps) {
    return (
        <div className={cn(ROW, "flex-row items-center justify-between gap-3", disabled && DISABLED_ROW)} data-row={label} data-disabled={disabled || undefined}
            aria-disabled={disabled || undefined} aria-describedby={disabled ? describedBy : undefined}>
            <RowLabel label={label} hint={hint} />
            <fieldset disabled={disabled} className="m-0 flex shrink-0 items-center gap-2 border-0 p-0">
                {value === undefined && <NotReadNote />}
                <OnOffToggle label={label} unknown={value === undefined} value={value === 1} onToggle={(on) => { if (!disabled) onChange(on ? 1 : 0); }} />
            </fieldset>
        </div>
    );
}

interface SliderRowProps {
    label: string;
    hint?: ReactNode;
    /** The slider's position, 0 to max; undefined when the board gave no value. */
    index: number | undefined;
    max: number;
    /** What a position reads as: "1.0×", "650 ms". */
    format: (index: number) => string;
    onCommit: (index: number) => void;
    disabled?: boolean;
    /** With disabled: the line that says why (aria-describedby). */
    describedBy?: string;
}

/** A slider over a fixed list of positions, written when it is let go. */
export function SliderRow({ label, hint, index, max, format, onCommit, disabled, describedBy }: SliderRowProps) {
    const [draft, setDraft] = useState(index ?? 0);
    useEffect(() => { if (index !== undefined) setDraft(index); }, [index]);
    return (
        <div className={cn(ROW, disabled && describedBy && DISABLED_ROW)} data-row={label} data-disabled={disabled || undefined}
            aria-disabled={disabled || undefined} aria-describedby={disabled ? describedBy : undefined}>
            <div className="flex items-baseline justify-between gap-3">
                <RowLabel label={label} hint={hint} />
                {index === undefined
                    ? <NotReadNote />
                    : <span className="shrink-0 text-sm font-medium tabular-nums text-kb-ink" data-row-value>{format(draft)}</span>}
            </div>
            <Slider
                aria-label={label}
                aria-valuetext={index === undefined ? undefined : format(draft)}
                aria-describedby={disabled ? describedBy : undefined}
                min={0}
                max={max}
                step={1}
                value={[draft]}
                disabled={disabled}
                onValueChange={([i]) => setDraft(i)}
                onValueCommit={([i]) => { if (i !== index) onCommit(i); }}
            />
        </div>
    );
}

interface RangeRowProps {
    label: string;
    hint?: ReactNode;
    value: number | undefined;
    min: number;
    max: number;
    step?: number;
    /** What a stored value reads as: "650 ms". */
    format?: (value: number) => string;
    onCommit: (value: number) => void;
    disabled?: boolean;
}

/** A numeric range from the firmware's own menu, read as a plain value. */
export function RangeRow({ label, hint, value, min, max, step = 1, format = String, onCommit, disabled }: RangeRowProps) {
    const clamp = (v: number) => Math.max(min, Math.min(max, v));
    return (
        <SliderRow
            label={label}
            hint={hint}
            index={value === undefined ? undefined : Math.round((clamp(value) - min) / step)}
            max={Math.round((max - min) / step)}
            format={(i) => format(min + i * step)}
            onCommit={(i) => onCommit(clamp(min + i * step))}
            disabled={disabled}
        />
    );
}

export function SelectRow({ label, hint, value, options, onChange, disabled, describedBy }: {
    label: string;
    hint?: ReactNode;
    value: number | undefined;
    options: { value: number; label: string }[];
    onChange: (v: number) => void;
} & DisabledProps) {
    const known = value !== undefined && options.some((o) => o.value === value);
    return (
        <div className={cn(ROW, "flex-row items-center justify-between gap-3", disabled && DISABLED_ROW)} data-row={label} data-disabled={disabled || undefined}
            aria-disabled={disabled || undefined} aria-describedby={disabled ? describedBy : undefined}>
            <RowLabel label={label} hint={hint} />
            <Select value={known ? String(value) : ""} onValueChange={(v) => onChange(parseInt(v, 10))} disabled={disabled}>
                <SelectTrigger aria-label={label} aria-describedby={disabled ? describedBy : undefined} className="w-32 shrink-0">
                    <SelectValue placeholder={value === undefined ? "Not read" : `Value ${value}`} />
                </SelectTrigger>
                <SelectContent>
                    {options.map((o) => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
    );
}

/** Two or three named choices side by side, one of them chosen. */
export function ChoiceRow({ label, hint, value, choices, onChange }: {
    label: string;
    hint?: ReactNode;
    value: number | undefined;
    choices: { value: number; label: string }[];
    onChange: (v: number) => void;
}) {
    const labelId = `choice-${label.replace(/\W+/g, "-").toLowerCase()}`;
    return (
        <div className={cn(ROW, "flex-row flex-wrap items-center justify-between gap-3")} data-row={label}>
            <RowLabel label={label} hint={hint} id={labelId} />
            <div className="flex shrink-0 items-center gap-2">
                {value === undefined && <NotReadNote />}
                <div role="radiogroup" aria-labelledby={labelId} className="flex rounded-full border border-kb-gray-border p-0.5">
                    {choices.map((c) => (
                        <button
                            key={c.value}
                            type="button"
                            role="radio"
                            aria-checked={value === c.value}
                            onClick={() => onChange(c.value)}
                            className={cn(
                                "rounded-full px-3 py-1 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                                value === c.value ? "bg-kb-active text-kb-active-fg" : "text-muted-foreground hover:text-kb-ink",
                            )}
                            data-choice={c.value}
                        >
                            {c.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

