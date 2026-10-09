import { useEffect, useId, useState } from "react";
import { Popover } from "radix-ui";

import CustomColorDialog from "@/components/CustomColorDialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { hexToHsv } from "@/utils/color-conversion";

import { COLOR_FIELD_SWATCHES, HEX_COLOR } from "./color-swatches";

// N-15 Color field (docs/practice/spec.md §5.0.3, O3): picks a free #rrggbb value that is user data
// (the overlay's appearance colors), not chrome. A 28 px swatch in the layer-dot idiom with a permanent
// hairline, because the default Outline only colors are exactly the ones that vanish on the panel. It
// opens a portaled popover (it sits inside the detail panel's scroll owner, which would clip an
// absolutely positioned one) with the brand swatches, a hex input and "More colors…", which opens
// Keybard's own picker (CustomColorDialog) without its LED target. No native color input.

interface ColorFieldProps {
    /** The row title, e.g. "Outline"; the popover and the dialog say "Outline color". */
    label: string;
    value: string;
    onChange: (hex: string) => void;
}

export function ColorField({ label, value, onChange }: ColorFieldProps) {
    const [open, setOpen] = useState(false);
    const [more, setMore] = useState(false);
    const [draft, setDraft] = useState(value);
    const errorId = useId();
    const current = value.toLowerCase();
    // The input follows the value whenever the popover opens or the value changes elsewhere.
    useEffect(() => { setDraft(value); }, [value, open]);
    const invalid = !HEX_COLOR.test(draft);
    const hsv = HEX_COLOR.test(value) ? hexToHsv(value) : { hue: 0, sat: 0, val: 0 };

    return (
        <>
            <Popover.Root open={open} onOpenChange={setOpen}>
                <Popover.Trigger asChild>
                    <button
                        type="button"
                        aria-label={`${label} color, ${current}`}
                        className={cn(
                            "size-7 shrink-0 rounded-full ring-1 ring-kb-ink/50 cursor-pointer transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                            open && "outline outline-2 outline-offset-2 outline-kb-ink",
                        )}
                        style={{ backgroundColor: value }}
                    />
                </Popover.Trigger>
                <Popover.Portal>
                    <Popover.Content
                        aria-label={`${label} color`}
                        side="bottom"
                        align="end"
                        sideOffset={8}
                        collisionPadding={12}
                        className="z-[80] w-64 max-w-[calc(100vw-24px)] bg-kb-popover rounded-3xl p-2 shadow-xl border border-gray-200 dark:border-neutral-700 text-kb-ink"
                    >
                        <p className="px-3 pt-2 pb-1 text-sm font-medium">{label} color</p>
                        <div className="grid grid-cols-6 gap-2.5 px-3 pt-1 pb-2.5">
                            {COLOR_FIELD_SWATCHES.map((swatch) => {
                                const selected = swatch.hex === current;
                                return (
                                    <button
                                        key={swatch.hex}
                                        type="button"
                                        aria-label={swatch.name}
                                        aria-pressed={selected}
                                        onClick={() => { onChange(swatch.hex); setOpen(false); }}
                                        className={cn(
                                            "size-5 rounded-full ring-1 ring-kb-ink/50 cursor-pointer transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                                            selected && "ring-2 ring-kb-ink ring-offset-2 ring-offset-kb-popover",
                                        )}
                                        style={{ backgroundColor: swatch.hex }}
                                    />
                                );
                            })}
                        </div>
                        <div className="px-3 pb-1.5">
                            <Input
                                aria-label={`${label} color hex`}
                                aria-invalid={invalid || undefined}
                                aria-describedby={invalid ? errorId : undefined}
                                value={draft}
                                maxLength={7}
                                spellCheck={false}
                                onChange={(e) => {
                                    const next = e.target.value.trim();
                                    setDraft(next);
                                    if (HEX_COLOR.test(next)) onChange(next.toLowerCase());
                                }}
                                className="h-8 font-mono text-sm select-text"
                            />
                            {invalid && <p id={errorId} className="mt-1.5 text-sm text-red-700 dark:text-red-400">Use #rrggbb</p>}
                        </div>
                        <button
                            type="button"
                            onClick={() => { setOpen(false); setMore(true); }}
                            className="flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-sm text-left cursor-pointer hover:bg-accent hover:text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                            <span>More colors…</span>
                            <span aria-hidden="true" className="text-xs text-muted-foreground">&rsaquo;</span>
                        </button>
                    </Popover.Content>
                </Popover.Portal>
            </Popover.Root>
            <CustomColorDialog
                open={more}
                onOpenChange={setMore}
                displayOnly
                title={`${label} color`}
                initialDisplayHue={hsv.hue}
                initialDisplaySat={hsv.sat}
                initialDisplayVal={hsv.val}
                initialDisplayHex={HEX_COLOR.test(value) ? value : undefined}
                // The exact hex: Apply without moving a slider keeps the color, and a typed hex passes through.
                onApply={(_display, _led, hex) => onChange(hex.toLowerCase())}
            />
        </>
    );
}

export default ColorField;
