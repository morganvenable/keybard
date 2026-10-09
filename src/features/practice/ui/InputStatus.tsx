import { Popover } from "radix-ui";
import { Unplug } from "lucide-react";

import { PILL_BRAND, PILL_INK } from "@/components/shared/pills";
import { cn } from "@/lib/utils";
import type { PracticeController } from "../state/controller";
import { POPOVER_CLASSES } from "./KeyPopover";

// P4 Input status pill and popover (docs/practice/spec.md §3.2, §5.6). M1b is Keymap only: the pill reads
// Keymap only, or Paused while the lesson is paused. The popover says what the user gets and, when not,
// why, as row values; unavailable actions are not drawn as disabled buttons.
// TODO(practice): M2 adds Live · USB (green dot, Pressed keys Shown, Layer Live).

export type InputPillState = "keymap" | "paused";

export function inputPillState(controller: PracticeController): InputPillState {
    return controller.paused ? "paused" : "keymap";
}

export const PILL_TEXT: Record<InputPillState, string> = { keymap: "Keymap only", paused: "Paused" };

/** The pill's dot: a gray ring for Keymap only, a gray dot while paused (§5.6). */
export function InputDot({ state }: { state: InputPillState }) {
    return state === "paused"
        ? <span aria-hidden="true" className="size-2 rounded-full bg-kb-gray-border" />
        : <span aria-hidden="true" className="size-2 rounded-full border-2 border-kb-gray-border" />;
}

/** Pressed keys row value (§5.6). */
export function pressedKeysValue(controller: PracticeController): string {
    const k = controller.keymap;
    if (!k?.hidSupported) return "Not shown · needs Chrome or Edge";
    if (!k.connected) return "Not shown · connect the board";
    if (!controller.settings.readKeyPresses) return "Not shown · reading is off";
    // TODO(practice): M2 reads the board (Live · USB); until then Practice is Keymap only.
    return "Not shown · keymap only for now";
}

interface InputStatusProps {
    controller: PracticeController;
    onConnect: () => void;
}

export function InputStatus({ controller, onConnect }: InputStatusProps) {
    const state = inputPillState(controller);
    const k = controller.keymap;
    const rows: [string, string][] = [
        ["Pressed keys", pressedKeysValue(controller)],
        ["Layer", "From keymap"],
        ["Keymap", controller.sourceName || "—"],
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
                        {rows.map(([label, value]) => (
                            <div key={label} className="flex items-start justify-between gap-4">
                                <dt className="text-muted-foreground whitespace-nowrap">{label}</dt>
                                <dd className="text-right">{value}</dd>
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
