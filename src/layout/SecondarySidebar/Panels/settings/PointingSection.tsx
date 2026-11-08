import { useCallback, useEffect, useMemo } from "react";

import { StepControl } from "@/components/touchpad-tuning/TouchpadTuning";
import { openTouchpadTuning } from "@/components/touchpad-tuning/tuning-open";
import { useTouchpadModeChange, useWriteTouchpadMode } from "@/components/touchpad-tuning/TouchpadMode";
import { Button } from "@/components/ui/button";
import { useKeyboard } from "@/contexts/KeyboardContext";
import { usePanels } from "@/contexts/PanelsContext";
import { useSettings } from "@/contexts/SettingsContext";
import { pointingMenuIndex, useMenuValues } from "@/hooks/useMenuValues";
import type { CustomUIMenuItem } from "@/types/keyboard.types";
import type { Side } from "@/utils/pointing-hardware";
import {
    AUTOMOUSE_DECAY_KEY, AUTOMOUSE_ENABLE_KEY, AUTOMOUSE_NO_TIMEOUT_KEY, AUTOMOUSE_THRESHOLD_KEY, AUTOMOUSE_TIMEOUT_KEY, AXIS_LOCK_KEY,
    dpiChoices, effectiveDpiIndex, findMenuItem, formatScrollSpeed, HAND_KEYS, hasScrollSpeed, hasTrackpointSpeed, maxDpiFor,
    NATURAL_SCROLL_KEY, pointingHands, SCROLL_SPEED_STEPS, scrollSpeedIndex, scrollSpeedPercent, type HandModel,
} from "@/utils/pointing-settings";
import { boardHasTouchpad, PAD_HOLD_KEY, PAD_HOLD_MS, PAD_HOLD_MS_KEY, PAD_TAP_KEY, PAD_TWO_FINGER_KEY, padsInTouchpadMode } from "@/utils/touchpad-taps";
import {
    formatMm, formatPalm, hasPadMode, hasPadPalm, hasPadTouch, hasPadTuning, PAD_DEAD_ZONE_DEFAULT, PAD_DEAD_ZONE_KEY, PAD_DEAD_ZONE_MM100,
    PAD_MODE_AUTO, PAD_MODE_BUILTIN, PAD_MODE_KEY, PAD_MODE_LABELS, PAD_PALM_CHANNELS, PAD_PALM_KEY, PAD_SCROLL_KEY, PAD_SCROLL_MM100,
    PAD_TAP_DEFAULT_MS, PAD_TAP_MS, PAD_TAP_MS_KEY,
} from "@/utils/touchpad-tuning";
import { onPointingAdvancedRequest, takePointingAdvancedRequest } from "./anchor";
import { POINTING_ADVANCED, POINTING_ADVANCED_ID } from "./layout";
import { ChoiceRow, Disclosure, RangeRow, SelectRow, SliderRow, ToggleRow } from "./PointingControls";
import { useStickySections } from "./useStickySections";

const SIDE_NAME: Record<Side, string> = { left: "Left hand", right: "Right hand" };

const SCROLL_MODE_HINT: Record<string, string> = {
    pmw3360: "Rolling the ball scrolls instead of moving the pointer",
    pmw3389: "Rolling the ball scrolls instead of moving the pointer",
    azoteq: "One finger scrolls instead of moving the pointer",
    trackpoint: "Pushing the stick scrolls instead of moving the pointer",
};

/**
 * Settings > Pointing: one card per hand, named by the module detected on it.
 * The simple view of a card is Pointer speed, Scroll speed and Scroll Mode, and
 * for a touchpad Gestures first. Natural Scroll and Axis Lock are shared by both
 * hands. One Advanced disclosure holds the rest: the auto mouse layer, the
 * touchpad's taps, drag and scrolling, and the live views.
 */
export default function PointingSection() {
    const { keyboard, isConnected } = useKeyboard();
    const { setActivePanel } = usePanels();
    const { getSetting, updateSetting } = useSettings();
    const menuIndex = pointingMenuIndex(keyboard?.menus);
    const menu = menuIndex >= 0 ? keyboard?.menus?.[menuIndex] : undefined;
    const { values, setValue, writeError } = useMenuValues(menu);
    const sticky = useStickySections(POINTING_ADVANCED, (name) => getSetting(name), (name, value) => updateSetting(name, value));

    // Opened at Advanced from a link (?panel=pointing-advanced): for this visit only.
    useEffect(() => {
        if (takePointingAdvancedRequest()) sticky.openForVisit(POINTING_ADVANCED_ID);
        return onPointingAdvancedRequest(() => sticky.openForVisit(POINTING_ADVANCED_ID));
    }, [sticky.openForVisit]);

    const flags3 = keyboard?.feature_flags3;
    const flags4 = keyboard?.feature_flags4;
    const hands = useMemo(() => pointingHands(keyboard), [keyboard]);
    const hasPad = hands.some((h) => h.module === "azoteq") || (!keyboard?.pointing_hardware && boardHasTouchpad(keyboard));
    const hasBall = hands.some((h) => h.module === "pmw3360" || h.module === "pmw3389");
    const padsOs = padsInTouchpadMode(keyboard);
    const modeOn = hasPadMode(flags4) && !!findMenuItem(menu?.content as CustomUIMenuItem[] | undefined, PAD_MODE_KEY);
    const modeValue = values.get(PAD_MODE_KEY);

    const set = useCallback((key: string, value: number) => { void setValue(key, value); }, [setValue]);
    // The pad's values are tuned against the live view: written at once, board state, never a pending change.
    const setNow = useCallback((key: string, value: number) => { void setValue(key, value, { now: true }); }, [setValue]);
    const writeMode = useWriteTouchpadMode(setValue);
    const modeChange = useTouchpadModeChange((m) => { void writeMode(m); });

    if (!keyboard || !menu) return null;
    const item = (key: string) => findMenuItem(menu.content as CustomUIMenuItem[], key);
    const toggle = (key: string, label: string, hint?: string) => item(key)
        ? <ToggleRow key={key} label={label} hint={hint} value={values.get(key)} onChange={(v) => set(key, v)} />
        : null;

    const gestures = (
        <ChoiceRow
            key="gestures"
            label="Gestures"
            hint="Automatic lets Windows and Linux drive the pad. A Mac always uses Built-in gestures."
            value={modeValue}
            choices={[PAD_MODE_AUTO, PAD_MODE_BUILTIN].map((m) => ({ value: m, label: PAD_MODE_LABELS[m] }))}
            onChange={(m) => modeChange.change(m, modeValue ?? PAD_MODE_AUTO)}
        />
    );

    const pointerSpeed = (hand: HandModel) => {
        const dpi = item(HAND_KEYS[hand.side].dpi);
        const max = maxDpiFor(hand.module, hasTrackpointSpeed(flags4));
        if (!dpi || max === undefined) return null;
        const choices = dpiChoices(dpi.options, max);
        if (!choices.length) return null;
        const hint = hand.module === "azoteq" ? `${choices[choices.length - 1].dpi} is this pad's full resolution`
            : hand.module === "trackpoint" ? "Software speed. 800 is the standard"
            : max ? `Sensor DPI, up to ${choices[choices.length - 1].dpi} on this sensor` : "Sensor DPI";
        return (
            <SelectRow
                key="pointer-speed"
                label="Pointer speed"
                hint={hint}
                value={effectiveDpiIndex(choices, values.get(HAND_KEYS[hand.side].dpi))}
                options={choices.map((c) => ({ value: c.index, label: String(c.dpi) }))}
                onChange={(index) => set(HAND_KEYS[hand.side].dpi, index)}
            />
        );
    };

    const scrollSpeed = (hand: HandModel) => {
        const key = HAND_KEYS[hand.side].scrollSpeed;
        if (!hasScrollSpeed(flags4) || !item(key)) return null;
        const stored = values.get(key);
        const hint = hand.module === "azoteq"
            ? (padsOs ? "Windows and Linux scroll the pad in Automatic. This applies with Built-in gestures." : "Two-finger scrolling and Scroll Mode. Does not change with pointer speed.")
            : "Does not change with pointer speed";
        return (
            <SliderRow
                key="scroll-speed"
                label="Scroll speed"
                hint={hint}
                index={stored === undefined ? undefined : scrollSpeedIndex(stored)}
                max={SCROLL_SPEED_STEPS.length - 1}
                format={(i) => formatScrollSpeed(SCROLL_SPEED_STEPS[i])}
                onCommit={(i) => set(key, scrollSpeedPercent(i))}
            />
        );
    };

    const handCard = (hand: HandModel) => (
        <div key={hand.side} className="flex flex-col gap-2 rounded-lg border border-kb-gray-border p-3" data-hand={hand.side} data-module={hand.module ?? "unknown"}>
            <h5 className="flex flex-col text-sm font-semibold text-kb-ink">
                <span>{SIDE_NAME[hand.side]}</span>
                <span className="text-xs font-normal text-muted-foreground">{hand.moduleName}</span>
            </h5>
            {hand.module === "azoteq" && modeOn && gestures}
            {pointerSpeed(hand)}
            {scrollSpeed(hand)}
            {toggle(HAND_KEYS[hand.side].scroll, "Scroll Mode", SCROLL_MODE_HINT[hand.module ?? ""] ?? "The pointer scrolls instead of moving")}
        </div>
    );

    // ---- Advanced
    const autoOn = values.get(AUTOMOUSE_ENABLE_KEY) === 1;
    const noTimeout = values.get(AUTOMOUSE_NO_TIMEOUT_KEY);
    const range = (key: string, label: string, hint: string, format: (v: number) => string, scale = 1) => {
        const it = item(key);
        const [min, max, step] = (it?.options ?? []) as number[];
        if (!it || max === undefined) return null;
        return (
            <RangeRow key={key} label={label} hint={hint} value={values.get(key)} min={min ?? 0} max={max} step={step ?? 1}
                format={(v) => format(v * scale)} onCommit={(v) => set(key, v)} />
        );
    };
    const autoMouse = item(AUTOMOUSE_ENABLE_KEY) && (
        <Disclosure key="auto" id="pointing-automouse" level={6} title="Auto mouse layer" open={sticky.isOpen("pointing-automouse")} onToggle={() => sticky.toggle("pointing-automouse")}>
            {toggle(AUTOMOUSE_ENABLE_KEY, "Enable Auto Mouse", "Switch to the mouse layer when a pointer moves")}
            {autoOn && hands.map((h) => toggle(HAND_KEYS[h.side].automouse, `${h.side === "left" ? "Left" : "Right"} Pointer Activates`, "This hand switches to the mouse layer"))}
            {autoOn && toggle(AUTOMOUSE_NO_TIMEOUT_KEY, "No Layer Timeout", "The layer never returns on its own")}
            {autoOn && noTimeout === 0 && range(AUTOMOUSE_TIMEOUT_KEY, "Layer Timeout", "How long the layer stays once the pointer rests", (v) => `${v} ms`)}
            {autoOn && range(AUTOMOUSE_THRESHOLD_KEY, "Activation Threshold", "Ignores small bumps. 0 switches on any motion", String)}
            {autoOn && range(AUTOMOUSE_DECAY_KEY, "Activation Decay", "How long movement counts before it is forgotten", (v) => `${v} ms`, 10)}
        </Disclosure>
    );

    const tuning = hasPadTuning(flags3);
    const builtIn = hasPad && !padsOs;
    const holdOn = (values.get(PAD_HOLD_KEY) ?? 1) !== 0;
    const tapsShown = hasPad && builtIn && (item(PAD_TAP_KEY) || tuning);
    const taps = tapsShown && (
        <Disclosure key="taps" id="pointing-taps" level={6} title="Touchpad taps and drag" open={sticky.isOpen("pointing-taps")} onToggle={() => sticky.toggle("pointing-taps")}>
            {toggle(PAD_TAP_KEY, "Tap to Click")}
            {toggle(PAD_TWO_FINGER_KEY, "Two-Finger Tap to Right Click")}
            {toggle(PAD_HOLD_KEY, "Press and Hold to Drag")}
            {tuning && (
                <>
                    <StepControl label="Tap Time" value={values.get(PAD_TAP_MS_KEY) || PAD_TAP_DEFAULT_MS} table={PAD_TAP_MS} format={(v) => `${v} ms`}
                        onChange={(v) => setNow(PAD_TAP_MS_KEY, v)} note="Lift within this to tap" />
                    <StepControl label="Hold Time" value={values.get(PAD_HOLD_MS_KEY) || PAD_HOLD_MS[0]} table={PAD_HOLD_MS} format={(v) => `${v} ms`}
                        onChange={(v) => setNow(PAD_HOLD_MS_KEY, v)} disabled={!holdOn}
                        note={holdOn ? "Hold still this much longer to start a drag" : "Press and Hold to Drag is off"} />
                    <StepControl label="Dead Zone" value={values.get(PAD_DEAD_ZONE_KEY) || PAD_DEAD_ZONE_DEFAULT} table={PAD_DEAD_ZONE_MM100} format={formatMm}
                        onChange={(v) => setNow(PAD_DEAD_ZONE_KEY, v)} note="How far a finger can move and still tap or hold" />
                </>
            )}
        </Disclosure>
    );

    const palmOn = hasPad && hasPadPalm(flags4);
    const scrollStartOn = hasPad && tuning && builtIn;
    const palmValue = values.get(PAD_PALM_KEY) ?? 0;
    const palmTable = (PAD_PALM_CHANNELS as readonly number[]).includes(palmValue) ? PAD_PALM_CHANNELS : [...PAD_PALM_CHANNELS, palmValue];
    const scroll = values.get(PAD_SCROLL_KEY) ?? 0;
    const scrollTable = (PAD_SCROLL_MM100 as readonly number[]).includes(scroll) ? PAD_SCROLL_MM100.slice(1) : [...PAD_SCROLL_MM100.slice(1), scroll];
    const scrolling = (palmOn || scrollStartOn) && (
        <Disclosure key="scrolling" id="pointing-scrolling" level={6} title="Touchpad scrolling" open={sticky.isOpen("pointing-scrolling")} onToggle={() => sticky.toggle("pointing-scrolling")}>
            {scrollStartOn && (
                <StepControl label="Scroll Start" value={scroll} table={scrollTable} format={formatMm} onChange={(v) => setNow(PAD_SCROLL_KEY, v)}
                    note="How far two fingers move before they scroll" />
            )}
            {palmOn && (
                <StepControl label="Palm Rejection" value={palmValue} table={palmTable} format={formatPalm} onChange={(v) => setNow(PAD_PALM_KEY, v)}
                    note="Ignores a contact wider than this" />
            )}
        </Disclosure>
    );

    const padLive = hasPad && hasPadTuning(flags3) && hasPadTouch(flags3);
    const live = (hasPad || hasBall) && (
        <Disclosure key="live" id="pointing-live" level={6} title="Live view" open={sticky.isOpen("pointing-live")} onToggle={() => sticky.toggle("pointing-live")}>
            {hasPad && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md px-3 py-2 panel-layer-item" data-row="Touchpads">
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-sm text-kb-ink">Touchpads</span>
                        <span className="text-xs text-muted-foreground">
                            {padLive ? "See each touch on the pads. Every finger, two-finger scroll and tap guides, live" : "This firmware can't show the pads live. Update it to see each touch."}
                        </span>
                    </div>
                    <Button variant="outline" size="sm" onClick={openTouchpadTuning} disabled={!padLive || !isConnected}>Open live view</Button>
                </div>
            )}
            {hasBall && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md px-3 py-2 panel-layer-item" data-row="Trackball sensors">
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-sm text-kb-ink">Trackball sensors</span>
                        <span className="text-xs text-muted-foreground">Surface quality and readings for each sensor</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setActivePanel("trackball")}>Open sensor view</Button>
                </div>
            )}
        </Disclosure>
    );

    const groups = [autoMouse, taps, scrolling, live].filter(Boolean);

    return (
        <div className="flex flex-col gap-3 px-3 pt-3 pb-3" data-pointing-section>
            <div className="grid gap-3 @2xl:grid-cols-2" data-hands>
                {hands.map(handCard)}
            </div>
            <div className="flex flex-col gap-2" data-shared>
                {toggle(NATURAL_SCROLL_KEY, "Natural Scroll", "Content follows your fingers, as on a phone")}
                {toggle(AXIS_LOCK_KEY, "Axis Lock", "Scrolling holds to one direction at a time. Not on a Mac.")}
            </div>
            {modeChange.confirm}
            {writeError && <p className="text-sm text-kb-touch-cancel" role="alert" data-write-error>{writeError}</p>}
            {groups.length > 0 && (
                <Disclosure id={POINTING_ADVANCED_ID} title="Advanced" summary="Auto mouse layer, taps, drag, palm rejection and the live view"
                    open={sticky.isOpen(POINTING_ADVANCED_ID)} onToggle={() => sticky.toggle(POINTING_ADVANCED_ID)}>
                    <div className="flex flex-col gap-3">{groups}</div>
                </Disclosure>
            )}
        </div>
    );
}
