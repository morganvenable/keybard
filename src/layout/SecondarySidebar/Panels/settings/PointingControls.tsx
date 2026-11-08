import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import OnOffToggle from "@/components/ui/OnOffToggle";
import { NotReadNote } from "@/components/CustomUI/controls/NotRead";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

/**
 * The rows of Settings > Pointing. Every row is a label with one plain line under
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

export function ToggleRow({ label, hint, value, onChange }: { label: string; hint?: ReactNode; value: number | undefined; onChange: (v: number) => void }) {
    return (
        <div className={cn(ROW, "flex-row items-center justify-between gap-3")} data-row={label}>
            <RowLabel label={label} hint={hint} />
            <div className="flex shrink-0 items-center gap-2">
                {value === undefined && <NotReadNote />}
                <OnOffToggle label={label} unknown={value === undefined} value={value === 1} onToggle={(on) => onChange(on ? 1 : 0)} />
            </div>
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
}

/** A slider over a fixed list of positions, written when it is let go. */
export function SliderRow({ label, hint, index, max, format, onCommit, disabled }: SliderRowProps) {
    const [draft, setDraft] = useState(index ?? 0);
    useEffect(() => { if (index !== undefined) setDraft(index); }, [index]);
    return (
        <div className={ROW} data-row={label} data-disabled={disabled || undefined}>
            <div className="flex items-baseline justify-between gap-3">
                <RowLabel label={label} hint={hint} />
                {index === undefined
                    ? <NotReadNote />
                    : <span className="shrink-0 text-sm font-medium tabular-nums text-kb-ink" data-row-value>{format(draft)}</span>}
            </div>
            <Slider
                aria-label={label}
                aria-valuetext={index === undefined ? undefined : format(draft)}
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

export function SelectRow({ label, hint, value, options, onChange }: {
    label: string;
    hint?: ReactNode;
    value: number | undefined;
    options: { value: number; label: string }[];
    onChange: (v: number) => void;
}) {
    const known = value !== undefined && options.some((o) => o.value === value);
    return (
        <div className={cn(ROW, "flex-row items-center justify-between gap-3")} data-row={label}>
            <RowLabel label={label} hint={hint} />
            <Select value={known ? String(value) : ""} onValueChange={(v) => onChange(parseInt(v, 10))}>
                <SelectTrigger aria-label={label} className="w-32 shrink-0">
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

/**
 * A heading that opens and collapses its body, remembered by the caller
 * (useStickySections). Used for the Advanced disclosure and its groups.
 */
export function Disclosure({ id, title, summary, open, onToggle, children, level = 5 }: {
    id: string;
    title: string;
    summary?: string;
    open: boolean;
    onToggle: () => void;
    children: ReactNode;
    level?: 5 | 6;
}) {
    const Heading = level === 5 ? "h5" : "h6";
    return (
        <section className="flex flex-col" data-disclosure={id} aria-labelledby={`${id}-title`}>
            <Heading id={`${id}-title`} className="text-sm font-semibold text-kb-ink">
                <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`${id}-body`}
                    onClick={onToggle}
                    className="flex w-full flex-row items-center justify-between gap-2 py-2 text-left"
                >
                    <span>
                        {title}
                        {summary && <span className="ml-2 text-xs font-normal text-muted-foreground">{summary}</span>}
                    </span>
                    <ChevronDown aria-hidden="true" className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
                </button>
            </Heading>
            {open && <div id={`${id}-body`} className="flex flex-col gap-2 pb-2">{children}</div>}
        </section>
    );
}
