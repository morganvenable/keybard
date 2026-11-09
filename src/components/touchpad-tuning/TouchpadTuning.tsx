import { useEffect, useMemo, useRef, useState } from "react";

import { Slider } from "@/components/ui/slider";
import { useKeyboard } from "@/contexts/KeyboardContext";
import { pointingMenuIndex, useMenuValues } from "@/hooks/useMenuValues";
import { cn } from "@/lib/utils";
import type { KeyboardInfo } from "@/types/keyboard.types";
import { getPadTouch } from "@/services/pad-touch.service";
import { boardHasTouchpad, PAD_HOLD_KEY, PAD_HOLD_MS, PAD_HOLD_MS_KEY } from "@/utils/touchpad-taps";
import {
    contactRadius, EMPTY_BLOCK, EMPTY_FINGERS, hasPadTouch, hasPadTuning, PAD_DEAD_ZONE_DEFAULT, PAD_DEAD_ZONE_KEY,
    PAD_HEIGHT_MM100, PAD_PALM_KEY, PAD_SCROLL_KEY, PAD_TAP_DEFAULT_MS, PAD_TAP_MS_KEY, PAD_WIDTH_MM100, steps, TouchTracker,
    type MultiTouch, type PadFingersBlock, type PadTouchBlock, type PadTouchReport, type TouchOutcome,
} from "@/utils/touchpad-tuning";
import { PadView, type PadTiming } from "./PadView";

/** Finished touches kept per pad, newest first, in the pad's scrolling list. */
const OUTCOMES = 50;

export interface StepProps {
    label: string;
    value: number;
    table: readonly number[];
    format: (v: number) => string;
    onChange: (v: number) => void;
    disabled?: boolean;
    note?: string;
}

/** A slider over exactly the values the board stores. */
export function StepControl({ label, value, table, format, onChange, disabled, note }: StepProps) {
    const list = useMemo(() => steps(table), [table]);
    const index = Math.max(0, list.findIndex((v) => v === value));
    const [draft, setDraft] = useState(index);
    useEffect(() => setDraft(index), [index]);
    return (
        <div className="flex flex-col gap-1.5 rounded-md px-3 py-2 panel-layer-item" data-step={label} data-disabled={disabled || undefined}>
            <div className="flex items-baseline justify-between gap-3">
                <span className={cn("text-sm", disabled ? "text-muted-foreground" : "text-kb-ink")}>{label}</span>
                <span className="text-sm font-medium tabular-nums text-kb-ink" data-step-value>{format(list[draft])}</span>
            </div>
            <Slider
                aria-label={label}
                aria-valuetext={format(list[draft])}
                min={0}
                max={list.length - 1}
                step={1}
                value={[draft]}
                disabled={disabled}
                onValueChange={([i]) => setDraft(i)}
                onValueCommit={([i]) => { if (list[i] !== value) onChange(list[i]); }}
            />
            {note && <span className="text-xs text-muted-foreground">{note}</span>}
        </div>
    );
}

interface PadLive {
    block: PadTouchBlock;
    events: number;
    trail: { x: number; y: number }[];
    outcomes: TouchOutcome[];
    count: number;
    fingers: PadFingersBlock;
    touch: MultiTouch | null;
    twoTrail: { x: number; y: number }[];
}

const NO_PAD: PadLive = { block: EMPTY_BLOCK, events: 0, trail: [], outcomes: [], count: 0, fingers: EMPTY_FINGERS, touch: null, twoTrail: [] };

interface LiveState {
    report: PadTouchReport | null;
    /**
     * The pads are in touchpad mode: the mode is the board's, one for both
     * pads, so any pad that answered saying so decides it (the other pad's
     * flag can drop for a few reports while the split link catches up), and
     * a report with no valid pad keeps the last answer. Nothing blinks.
     */
    padsOs: boolean | null; // null: no pad has answered yet
    readAt: number;
    left: PadLive;
    right: PadLive;
}

const NO_LIVE: LiveState = {
    report: null, readAt: 0, padsOs: null,
    left: NO_PAD,
    right: NO_PAD,
};

/** Before the first report: each pad drawn empty, not as "no touchpad", so nothing changes when it answers. */
const WAITING_BLOCK: PadTouchBlock = { ...EMPTY_BLOCK, valid: true };

/** A pad missing from the reports this long is shown as gone. */
const PAD_GONE_MS = 1000;

/** Both pads, live, while the view is open. */
function useLiveTouch(enabled: boolean, keyboard: KeyboardInfo | null | undefined, connected: boolean): LiveState {
    const [live, setLive] = useState<LiveState>(NO_LIVE);
    const trackers = useRef({ left: new TouchTracker(), right: new TouchTracker() });
    const lastValid = useRef({ left: -Infinity, right: -Infinity });
    const firstAt = useRef(Infinity);
    useEffect(() => { getPadTouch().setConnection(keyboard ?? null, connected); }, [keyboard, connected]);
    useEffect(() => {
        if (!enabled) return;
        const service = getPadTouch();
        const release = service.acquire();
        // A fresh start (opened, or the board back after an unplug): the mode is learned again from the
        // pads, never kept from before (it may have changed while the board was away).
        setLive((prev) => ({ ...prev, report: null, padsOs: null }));
        firstAt.current = Infinity;
        lastValid.current = { left: -Infinity, right: -Infinity };
        const unsubscribe = service.subscribe((report, at) => {
            if (firstAt.current === Infinity) firstAt.current = at;
            setLive((prev) => {
                const valid = [report.left, report.right].filter((b) => b.valid);
                const padsOs = valid.length ? valid.some((b) => b.os) : prev.padsOs;
                const next: LiveState = { report, readAt: at, padsOs, left: prev.left, right: prev.right };
                for (const side of ["left", "right"] as const) {
                    // A pad that answered within the last second keeps its last picture through a
                    // report without it (a fresh start, a missed split read): it never blinks to "no touchpad".
                    if (!report[side].valid && prev[side].block.valid && at - lastValid.current[side] < PAD_GONE_MS) continue;
                    // The first reads after the board starts following the pads have no pad yet: drawn empty for a moment.
                    if (!report[side].valid && lastValid.current[side] === -Infinity && at - firstAt.current < PAD_GONE_MS) {
                        next[side] = { ...prev[side], block: WAITING_BLOCK };
                        continue;
                    }
                    if (report[side].valid) lastValid.current[side] = at;
                    const t = trackers.current[side];
                    // Each pad's touch is read in the board's one mode (padsOs), not its own flag.
                    const block = report[side].valid ? { ...report[side], os: !!padsOs } : report[side];
                    const done = t.take(block, report, report.fingers?.[side] ?? null, report.fingers?.palm ?? 0);
                    next[side] = {
                        block,
                        events: t.touchEvents,
                        trail: t.trail,
                        outcomes: done ? [done, ...prev[side].outcomes].slice(0, OUTCOMES) : prev[side].outcomes,
                        count: prev[side].count + (done ? 1 : 0),
                        fingers: t.fingers,
                        touch: t.touch ? { ...t.touch } : null,
                        twoTrail: t.twoTrail,
                    };
                }
                return next;
            });
        });
        return () => { unsubscribe(); release(); };
    }, [enabled]);
    return live;
}

interface TouchpadTuningProps {
    /** Where it shows: the Settings card, or the dialog from Pointing Devices. */
    place: "settings" | "dialog";
}

/**
 * The live view of the touchpads: each pad drawn as it is touched, so a touch
 * shows why it clicked or not. The settings it explains (dead zone, tap and
 * hold times, scroll start, palm rejection) sit under the pads in the same modal (TouchpadSettings).
 * Shown only on firmware that has the tuning setting and a board
 * with a touchpad; the live pads need the touch page as well.
 */
export function TouchpadTuning({ place }: TouchpadTuningProps) {
    const { keyboard, isConnected } = useKeyboard();
    const menuIndex = pointingMenuIndex(keyboard?.menus);
    const menu = menuIndex >= 0 ? keyboard?.menus?.[menuIndex] : undefined;
    const { values } = useMenuValues(menu);
    const supported = !!keyboard && hasPadTuning(keyboard.feature_flags3) && boardHasTouchpad(keyboard);
    const liveOn = supported && isConnected && hasPadTouch(keyboard?.feature_flags3);
    const live = useLiveTouch(liveOn, keyboard, isConnected);
    // Each mode has its own layout, and the pads say which mode is in force. Until they first answer
    // (the first reads can come without a pad for up to a second), nothing shows, so the wrong layout
    // never flashes; with no answer in 3 s, touchpad mode.
    const [waited, setWaited] = useState(false);
    useEffect(() => {
        setWaited(false);
        if (!liveOn) return;
        const t = window.setTimeout(() => setWaited(true), 3000);
        return () => window.clearTimeout(t);
    }, [liveOn]);
    if (!supported) return <p className="px-3 py-2 text-sm text-muted-foreground">Connect a board with a touchpad to see it live.</p>;

    const deadZone = values.get(PAD_DEAD_ZONE_KEY) || PAD_DEAD_ZONE_DEFAULT;
    const tapMs = values.get(PAD_TAP_MS_KEY) || PAD_TAP_DEFAULT_MS;
    const holdMs = values.get(PAD_HOLD_MS_KEY) || PAD_HOLD_MS[0];
    const holdOn = (values.get(PAD_HOLD_KEY) ?? 1) !== 0;
    const scroll = values.get(PAD_SCROLL_KEY) ?? 0;
    const palmValue = values.get(PAD_PALM_KEY) ?? 0;
    const r = live.report;
    const timing: PadTiming = {
        deadZone: r?.deadZone ?? deadZone, tapMs: r?.tapMs ?? tapMs, holdMs: r?.holdMs ?? holdMs, holdOn: r?.holdOn ?? holdOn,
        width: r?.width ?? PAD_WIDTH_MM100, height: r?.height ?? PAD_HEIGHT_MM100, scrollStart: r?.scrollStart || scroll || 105,
    };
    const palm = r?.fingers?.palm ?? palmValue;
    // Touchpad mode (Input Mode 3): the computer makes the taps and scrolls from the contacts, with its own
    // settings, so the chip's gesture settings change nothing there. The pads' reports say which mode is in
    // force (the firmware clears their touchpad bits with built-in gestures, even while the OS asks).
    // Until the pads first answer, touchpad mode (what ships): the chip's settings never show and then vanish.
    // Each mode has its own layout: a deliberate switch may move things, touches arriving never do.
    // Unplugged, the layout stays the last one the pads said (no sliders that don't apply); back, the
    // pads are asked again (pending below).
    const osMode = live.padsOs ?? liveOn;
    const pending = liveOn && live.padsOs === null && !waited;

    const padProps = (side: "left" | "right") => ({
        side, block: live.report ? live[side].block : WAITING_BLOCK, readAt: live.readAt, touchEvents: live[side].events, trail: live[side].trail, count: live[side].count, timing,
        contactR: r ? contactRadius(live[side].block.area, r) : 0,
        outcomes: live[side].outcomes, fingers: live[side].fingers, touch: live[side].touch, twoTrail: live[side].twoTrail,
        radiusOf: (area: number) => (r ? contactRadius(area, r) : 0), palm, touchpadMode: osMode,
    });

    const pads = !liveOn ? (
        <p className="text-sm text-muted-foreground" data-live-absent>{isConnected ? "This firmware can't show the pads live. Update it to see each touch." : "Connect the board to see each touch."}</p>
    ) : (
        <div className={cn("flex flex-col gap-2", !osMode && "sm:min-h-0 sm:flex-1")}>
            <div className={cn("flex flex-col gap-6 @3xl:flex-row", !osMode && "sm:min-h-0 sm:flex-1")} data-pads>
                {(["left", "right"] as const).map((side) => (
                    <div key={side} className="flex min-w-0 flex-1 flex-col sm:min-h-0">
                        <PadView {...padProps(side)} />
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className={cn("@container flex flex-col gap-4", place === "settings" ? "px-3 pt-3 pb-1" : osMode ? "" : "sm:h-full", pending && "invisible")} aria-busy={pending || undefined} data-touchpad-tuning data-layout={osMode ? "os" : "gestures"}>
            {pads}
        </div>
    );
}
