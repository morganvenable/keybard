import { FunctionComponent, useState, useRef, useLayoutEffect, useEffect } from "react";
import { keyLegendsOptions } from "@/lib/keyLegendsSetting";
import { usePreviewedLayerColors } from "@/hooks/useLayerColorPreview";
import { useKeyBinding } from "@/contexts/KeyBindingContext";
import { useLayer } from "@/contexts/LayerContext";
import { useKeyboard } from "@/contexts/KeyboardContext";
import { Key } from "@/components/Key";
import { getKeyContents } from "@/utils/keys";
import { hoverBackgroundClasses, hoverBorderClasses, hoverHeaderClasses } from "@/utils/colors";
import { KeyContent } from "@/types/keyboard.types";
import { LAYOUTS, KEY_DISPLAY_OVERRIDES, US_SHIFT_ALIASES, keycodeForToken } from "@/components/Keyboards/layouts";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { applyModifiers, Modifier, ModifierSide, PLAIN_MODIFIER_KEYCODES, pickerBinding } from "@/utils/modifierUtils";
import { QWERTY_KEY_PX, TRAY_MIN_KEY_PX } from "@/lib/pickerShape";

interface IProps {
    /**
     * A key was clicked. `shifted`: the picker's own L SHIFT or R SHIFT is on and this key
     * shows its shifted symbol, so the binding is Shift (that side) plus the key, as shown.
     */
    onKeyPress?: (button: string, shifted?: ModifierSide | false) => void;
    activeModifiers?: string[];
    /** Hand used when activeModifiers are applied (RSFT(kc) vs LSFT(kc)). */
    modifierSide?: ModifierSide;
    hideLanguageSelector?: boolean;
    disableTooltip?: boolean;
    /** The AltGr button is on (activeModifiers holds Right Alt): the picker's own Shift goes off. */
    altGr?: boolean;
    /** Scale the keyboard to fit both its width and this height, by scaleFor, centered (the L-shaped picker's tray). */
    fit?: { maxHeight: number; scaleFor: (availableWidth: number, availableHeight: number, naturalWidth: number, naturalHeight: number) => number };
}

const QwertyKeyboard: FunctionComponent<IProps> = ({ onKeyPress: onKeyPressCallback, activeModifiers = [], modifierSide = "left", altGr = false, hideLanguageSelector = false, disableTooltip = false, fit }) => {
    // The picker's own Shift: off, or the side clicked. Caps Lock binds Caps Lock and leaves
    // the picker as it is (letters already draw as capitals), so display and binding agree.
    const [pickerShift, setPickerShift] = useState<ModifierSide | null>(null);
    const layoutName: "default" | "shift" = pickerShift ? "shift" : "default";
    const { internationalLayout, keyLegendsChoice, setInternationalLayout, layoutMode } = useLayoutSettings();
    const { keyboard } = useKeyboard();
    const { selectedLayer } = useLayer();
    const { isBinding } = useKeyBinding();

    const isCompact = layoutMode === "bottombar";

    const layerColorName = usePreviewedLayerColors(keyboard?.cosmetic?.layer_colors)?.[selectedLayer] || "primary";
    const hoverBorderColor = hoverBorderClasses[layerColorName] || hoverBorderClasses["primary"];
    const hoverBackgroundColor = hoverBackgroundClasses[layerColorName] || hoverBackgroundClasses["primary"];

    const hoverHeaderClass = hoverHeaderClasses[layerColorName] || hoverHeaderClasses["primary"];


    const currentLayout = LAYOUTS[internationalLayout] || LAYOUTS["us"];

    useEffect(() => {
        if (altGr) setPickerShift(null);
    }, [altGr]);

    const isShiftActive = activeModifiers.includes("Shift") || (layoutName === "shift" && !altGr);

    const onKeyPress = (button: string, shifted: ModifierSide | false = false) => {
        if (!isBinding || !keyboard) return;
        if (button === "{shiftleft}" || button === "{shiftright}") {
            setPickerShift(pickerShift ? null : button === "{shiftright}" ? "right" : "left");
        }
        if (onKeyPressCallback) {
            onKeyPressCallback(button, shifted);
        }
    };

    // Helper to get key width
    const getKeyWidth = (key: string): number => {
        // Special case for ISO Shift (smaller) vs ANSI Shift
        if (key === "{shiftleft}" && currentLayout.value !== "us") return 1.25; // ISO Left Shift
        if (key === "{shiftleft}" && currentLayout.value === "us") return 2.25; // ANSI Left Shift

        switch (key) {
            case "{backspace}": return 2;
            case "{tab}": return 1.5;
            case "\\": return 1.5;
            case "|": return 1.5;
            case "{capslock}": return 1.75;
            case "{enter}": return 2.25;
            case "{shiftright}": return 2.75;
            case "{controlleft}": return 1.25;
            case "{altleft}": return 1.25;
            case "{metaleft}": return 1.25;
            case "{space}": return 6.25;
            case "{metaright}": return 1.25;
            case "{altright}": return 1.25;
            case "{controlright}": return 1.25;
            default: return 1;
        }
    };

    const fitRef = useRef<HTMLDivElement>(null);
    const [availableWidth, setAvailableWidth] = useState(0);
    useLayoutEffect(() => {
        const element = fitRef.current;
        if (!element) return;
        const measure = () => setAvailableWidth(element.clientWidth);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    const naturalWidth = Math.max(...currentLayout.default.map(row => {
        const keys = row.split(" ");
        return keys.reduce((sum, key) => sum + getKeyWidth(key) * 30, 0) + (keys.length - 1) * 4;
    }));
    const naturalHeight = currentLayout.default.length * 30 + (currentLayout.default.length - 1) * 4;
    const scale = fit
        ? fit.scaleFor(availableWidth, fit.maxHeight, naturalWidth, naturalHeight)
        : availableWidth > 0 ? Math.max(TRAY_MIN_KEY_PX / QWERTY_KEY_PX, Math.min(1, availableWidth / naturalWidth)) : 1;

    const renderRow = (defaultRowStr: string, shiftRowStr: string, altgrRowStr = "") => {
        const defaultKeys = defaultRowStr.split(" ");
        const altgrKeys = altgrRowStr.split(" ");
        const shiftKeys = shiftRowStr.split(" ");

        return (
            <div className="flex gap-1 justify-center">
                {defaultKeys.map((defaultKey, i) => {
                    const shiftKey = shiftKeys[i] || defaultKey;

                    // Visual key is determined by shift state
                    const visualKey = isShiftActive ? shiftKey : defaultKey;

                    // Output key is ALWAYS the default key (base), so parent can apply modifiers
                    // Exception: If the key is specific to the shift layer (rare but possible), defaultKey might be weird?
                    // But in our layouts, default is strict base.
                    // A key is its position: the keycode comes from the key's own (unshifted) token, never from
                    // the character it shows. German Shift on the Y position draws "Z", which a US name lookup
                    // would send to KC_Z, the key that types Y; and Shift+2 draws a quote, KC_DQUO on US.
                    const resolveToken = (t: string) => keycodeForToken(internationalLayout, t);
                    const positionKeycode = resolveToken(defaultKey);
                    // The click hands over the position's keycode (structural {tokens} keep their name):
                    // with Shift it binds LSFT(that keycode), which the OS turns into the shown character.
                    const outputKey = defaultKey.startsWith("{") ? defaultKey : positionKeycode;
                    // With the picker's own Shift on, a key that shows its shifted symbol binds it
                    // (Shift plus the key), so what the key shows is what it binds.
                    const bindShifted = pickerShift && !altGr && shiftKey !== defaultKey && !defaultKey.startsWith("{") ? pickerShift : false;

                    // To get correct QMK keycode for display/icon lookup, we resolve the visual key
                    // key is "ç" or "a" or "{shift}"
                    const labelKey = visualKey;

                    let keycode = positionKeycode;
                    if (labelKey !== defaultKey) {
                        // The picker's own Shift draws the shifted character on a key that keeps
                        // its position's keycode. Where the character's US-name keycode is that
                        // same position (US: "!" is KC_EXLM, KC_1 shifted), it stays the drag payload.
                        const shownCode = resolveToken(labelKey);
                        const shownBase = US_SHIFT_ALIASES[shownCode] || shownCode;
                        if (shownBase === positionKeycode && shownCode !== positionKeycode) keycode = shownCode;
                    }


                    // Don't modify special structural keys
                    // const isStructureKey = keycode.startsWith("KC_") === false && !["{", "}"].some(c => keycode.includes(c));

                    // Actually check if it is a modifier key itself (e.g. KC_LSFT) or a structural key
                    // Simplified: if it's a regular keycode (starts with KC_ or is a character), apply modifiers
                    // But prevent modifying the modifiers themselves if mistakenly passed?
                    // Safe approach: apply activeModifiers if provided, but skip if keycode is weird.
                    // Actually, if we are DRAGGING, we want the modified keycode.
                    // If we are CLICKING, onKeyPress handles it (via BasicKeyboards callback which applies modifiers).
                    // So this change PRIMARILY affects the Key component's `keycode` prop, which determines drag payload.

                    // Exclude special UI keys from being modified
                    // const isSpecial = ["{shiftleft}", "{shiftright}", "{capslock}", "{space}"].includes(defaultKey);
                    // Note: {space} is KC_SPC, which CAN be modified.

                    // Apply modifiers to the keycode if valid
                    // We only modify if it looks like a basic keycode
                    if (activeModifiers.length > 0 &&
                        !["KC_TRNS", "KC_NO"].includes(keycode) &&
                        !PLAIN_MODIFIER_KEYCODES.has(keycode) &&
                        !keycode.includes("{") // Don't modify UI placeholders
                    ) {
                        // Check if keycode is a US Shift Alias (e.g. KC_EXLM -> KC_1)
                        // This prevents double-shifting (Shift + KC_EXLM) which causes issues
                        if (US_SHIFT_ALIASES[keycode]) {
                            keycode = US_SHIFT_ALIASES[keycode];
                        }

                        keycode = applyModifiers(keycode, activeModifiers as Modifier[], false, modifierSide);
                    }

                    // With the AltGr button on, only the keys that type an AltGr character stand out:
                    // the rest are dimmed, drawn plain (no RALT band), and bind as before.
                    const typesAltGr = !!altgrKeys[i] && altgrKeys[i] !== "{none}";
                    const dimmed = altGr && !typesAltGr && defaultKey !== "{altright}";
                    if (dimmed && keycode.startsWith("RALT(")) keycode = keycode.slice(5, -1);

                    const displayLabel = KEY_DISPLAY_OVERRIDES[visualKey] || visualKey.replace("{", "").replace("}", "");
                    const width = getKeyWidth(defaultKey); // Use default key for width lookup to be consistent
                    const keyContents = keyboard ? getKeyContents(keyboard, keycode) : undefined;


                    return (
                        <Key
                            key={`${defaultKey}-${i}`}
                            data-picker-key={defaultKey}
                            x={0} y={0} w={width} h={1} row={0} col={0}
                            keycode={keycode}
                            className={dimmed ? "opacity-40 pointer-events-none" : undefined}
                            // Dragging carries exactly what a click binds (one builder, pickerBinding).
                            dragItemData={{ keycode: pickerBinding(positionKeycode, activeModifiers as Modifier[], modifierSide, bindShifted) }}
                            disableDrag={dimmed}
                            hideModifierBand={activeModifiers.length === 1 && activeModifiers[0] === "Shift"}
                            label={displayLabel}
                            keyContents={keyContents as KeyContent | undefined}
                            layerColor="sidebar"
                            headerClassName={`bg-kb-sidebar-dark ${hoverHeaderClass}`}
                            isRelative
                            variant="small"
                            hoverBorderColor={hoverBorderColor}
                            hoverBackgroundColor={hoverBackgroundColor}
                            hoverLayerColor={layerColorName}
                            onClick={dimmed ? undefined : () => onKeyPress(outputKey, bindShifted)}
                            disableTooltip={disableTooltip}
                            forceLabel={true}
                            dragW={1}
                            dragH={1}
                        />
                    );
                })}
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-1 w-full min-w-0">
            {/* Language selector - hidden when hideLanguageSelector is true */}
            {!hideLanguageSelector && (
                isCompact ? (
                    <div className="flex flex-row items-center justify-end -mb-1">
                        <select
                            className="border rounded text-[10px] text-slate-500 dark:text-neutral-400 py-0.5 px-1 border-gray-200 dark:border-neutral-500 bg-gray-50 dark:bg-neutral-800/60 !outline-none focus:border-gray-300 dark:focus:border-neutral-400 cursor-pointer"
                            value={keyLegendsChoice}
                            onChange={(e) => setInternationalLayout(e.target.value)}
                            title="Keyboard layout"
                        >
                            {keyLegendsOptions(keyLegendsChoice, internationalLayout, true).map((kb) => (<option key={kb.value} value={kb.value}>{kb.label}</option>))}
                        </select>
                    </div>
                ) : (
                    <div className="flex flex-row items-center gap-2">
                        <select
                            className="border rounded-md text-lg text-slate-600 dark:text-neutral-300 py-4 border-none !outline-none focus:border-none focus:outline-none cursor-pointer font-semibold"
                            value={keyLegendsChoice}
                            onChange={(e) => setInternationalLayout(e.target.value)}
                        >
                            {keyLegendsOptions(keyLegendsChoice, internationalLayout).map((kb) => (<option key={kb.value} value={kb.value}>{kb.label}</option>))}
                        </select>
                    </div>
                )
            )}

            <div ref={fitRef} className="w-full min-w-0 overflow-hidden" data-fitted-keyboard style={{ height: naturalHeight * scale }}>
                {/* Zoom, not a transform: the keyboard's laid-out width is its scaled width, so it never makes its box scroll sideways. */}
                <div className="flex flex-col gap-1" style={{ width: naturalWidth, zoom: scale, marginLeft: fit ? Math.max(0, (availableWidth - naturalWidth * scale) / 2) / scale : undefined }}>
                    {currentLayout.default.map((row, i) => (
                        <div key={i}>{renderRow(row, currentLayout.shift[i], currentLayout.altgr?.[i])}</div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default QwertyKeyboard;
