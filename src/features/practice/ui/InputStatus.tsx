import { Popover } from "radix-ui";
import { Unplug } from "lucide-react";

import { PILL_BRAND, PILL_INK } from "@/components/shared/pills";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PracticeController } from "../state/controller";
import { POPOVER_CLASSES } from "./KeyPopover";

// P4 Input status pill and popover (docs/practice/spec.md §3.2, §5.6). The pill reads Live · USB (green dot)
// or Keymap only (gray ring), or Paused (gray dot) while the lesson is paused, whatever the mode. The
// popover says what the user gets and, when not, why, as row values; unavailable actions are not drawn as
// disabled buttons. Diagnostics (the sample rate and round trip, the keymap fingerprint) sit in the row's
// tooltip on focus or hover, not in the row. Live · Host is M5 (OWNER_Q3).

export type InputPillState = "usb" | "keymap" | "paused";

export function inputPillState(controller: PracticeController): InputPillState {
    return controller.paused ? "paused" : controller.inputMode;
}

export const PILL_TEXT: Record<InputPillState, string> = { usb: "Live · USB", keymap: "Keymap only", paused: "Paused" };

/** The pill's dot: brand green for a live source, a gray ring for Keymap only, a gray dot while paused (§5.6). */
export function InputDot({ state }: { state: InputPillState }) {
    if (state === "usb") return <span aria-hidden="true" className="size-2 rounded-full bg-kb-primary" />;
    return state === "paused"
        ? <span aria-hidden="true" className="size-2 rounded-full bg-kb-gray-border" />
        : <span aria-hidden="true" className="size-2 rounded-full border-2 border-kb-gray-border" />;
}

/** Pressed keys row value (§5.6). */
export function pressedKeysValue(controller: PracticeController): string {
    return controller.pressedKeysValue;
}

/** The sampler's numbers for the Pressed keys tooltip, or undefined before it has read anything. */
export function samplerDiagnostic(controller: PracticeController): string | undefined {
    const stats = controller.live?.stats();
    if (!controller.liveAvailable || !stats || stats.samples === 0) return undefined;
    const ms = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)} ms`);
    return `${stats.rate} samples/s · round trip ${ms(stats.rttP50)} (p95 ${ms(stats.rttP95)})`;
}

interface InputStatusProps {
    controller: PracticeController;
    onConnect: () => void;
}

export function InputStatus({ controller, onConnect }: InputStatusProps) {
    const state = inputPillState(controller);
    const k = controller.keymap;
    const fingerprint = controller.session?.fingerprint;
    const rows: [string, string, string?][] = [
        ["Pressed keys", pressedKeysValue(controller), samplerDiagnostic(controller)],
        ["Layer", controller.liveAvailable ? "Live" : "From keymap"],
        ["Keymap", controller.sourceName || "—", fingerprint ? `Keymap fingerprint ${fingerprint.slice(0, 12)}` : undefined],
    ];
    const canConnect = !!k?.hidSupported && !k.connected;
    return (
        <Popover.Root>
            <Popover.Trigger asChild>
                <button
                    type="button"
                    data-practice-input-pill={state}
                    className="flex items-center gap-2 text-sm font-medium pl-2 pr-5 py-1.5 rounded-full text-kb-ink cursor-pointer hover:bg-kb-gray-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                    <InputDot state={state} />
                    {PILL_TEXT[state]}
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content aria-label="Input" side="bottom" align="end" sideOffset={8} collisionPadding={12} className={cn(POPOVER_CLASSES, "flex flex-col gap-3")}>
                    <h2 className="text-base font-semibold">Input</h2>
                    <dl className="flex flex-col gap-2 text-sm">
                        {rows.map(([label, value, diagnostic]) => (
                            <div key={label} className="flex items-start justify-between gap-4">
                                <dt className="text-muted-foreground whitespace-nowrap">{label}</dt>
                                {diagnostic ? (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <dd tabIndex={0} data-diagnostic={diagnostic} className="text-right rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{value}</dd>
                                        </TooltipTrigger>
                                        <TooltipContent side="left">{diagnostic}</TooltipContent>
                                    </Tooltip>
                                ) : (
                                    <dd className="text-right">{value}</dd>
                                )}
                            </div>
                        ))}
                    </dl>
                    {(canConnect || k?.connected) && (
                        <div className="flex flex-wrap gap-2 pt-1">
                            {canConnect && (
                                <button type="button" className={PILL_BRAND} onClick={onConnect}><Unplug aria-hidden="true" />Connect board</button>
                            )}
                            {k?.connected && (
                                <button type="button" className={PILL_INK} onClick={() => controller.update({ readKeyPresses: !controller.settings.readKeyPresses })}>
                                    {controller.settings.readKeyPresses ? "Stop reading keys" : "Read key presses"}
                                </button>
                            )}
                        </div>
                    )}
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}

export default InputStatus;
