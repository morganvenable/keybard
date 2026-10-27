// The simulated board's contents the first time it connects: Keybard's default
// layout (the ?demo layout) with the ?demo=combos combos, tap dances and macros,
// two combo names and a few other names, in the keycode numbering the board
// reports (QMK 0.0.9).
import svilText from "@/default-layouts/sval-default.svil?raw";
import { DEMO_COMBO_NAMES, DEMO_FEATURES } from "@/lib/deepLinks";
import { activeKeycodeVersion, applyKeycodeNumbering } from "@/constants/keycode-numbering";
import { keyService } from "@/services/key.service";
import type { CustomKeycode } from "@/types/keyboard.types";
import {
    blankBoard, COLS, COMBO_SIZE, LABEL_SIZE, LABEL_TYPE_COMBO, LABEL_TYPE_LAYER, LABEL_TYPE_MACRO,
    LABEL_TYPE_TAP_DANCE, LAYERS, ROWS, TAP_DANCE_SIZE, type FakeBoardState,
} from "./board";
import { DEFINITION, FRAGMENT_INSTANCE_COUNT } from "./definition";
import { KEYCODES_VERSION } from "./firmware";

/** Names stored on the seeded board, by label type. */
export const SEED_NAMES = {
    [LABEL_TYPE_LAYER]: { 0: "Base", 1: "Numbers" },
    [LABEL_TYPE_TAP_DANCE]: { 0: "A or Ctrl" },
    [LABEL_TYPE_MACRO]: { 1: "Greeting" },
    [LABEL_TYPE_COMBO]: DEMO_COMBO_NAMES,
} as const satisfies Record<number, Record<string, string>>;

const COMBO_ENABLED = 0x8000;
const TAP_DANCE_ENABLED = 0x8000;
const KEY_OVERRIDE_ENABLED = 0x80;

function put16(bytes: Uint8Array, offset: number, value: number) {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = (value >> 8) & 0xff;
}

function putLabel(slots: Uint8Array, index: number, name: string) {
    const bytes = new TextEncoder().encode(name).subarray(0, LABEL_SIZE);
    slots.set(bytes, index * LABEL_SIZE);
}

/** Keycodes the way the board numbers them, with its own SV_ keycodes named. */
function keycodeParser(): (name: string) => number {
    const version = KEYCODES_VERSION.join(".");
    if (activeKeycodeVersion() !== version) applyKeycodeNumbering(version);
    keyService.registerKnownCustomKeycodes((DEFINITION.customKeycodes ?? []) as CustomKeycode[]);
    return (name: string) => {
        const code = keyService.parse(name);
        return Number.isFinite(code) && code >= 0 && code <= 0xffff ? code : 0;
    };
}

/** The keymap of the default layout, as the board stores it (big-endian keycodes). */
export function seedKeymap(kc = keycodeParser()): Uint8Array {
    const layout = (JSON.parse(svilText) as { layout?: string[][][] }).layout ?? [];
    const keymap = new Uint8Array(LAYERS * ROWS * COLS * 2);
    for (let l = 0; l < LAYERS; l++) {
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const name = layout[l]?.[r]?.[c];
                const code = name ? kc(name) : 0;
                const o = ((l * ROWS + r) * COLS + c) * 2;
                keymap[o] = code >> 8;
                keymap[o + 1] = code & 0xff;
            }
        }
    }
    return keymap;
}

/** QMK macro buffer bytes for one macro: text and single-key taps (SS_QMK_PREFIX, SS_TAP_CODE). */
function macroBytes(actions: readonly (readonly (string | number)[])[], kc: (name: string) => number): number[] {
    const out: number[] = [];
    for (const [kind, ...args] of actions) {
        if (kind === "text") out.push(...new TextEncoder().encode(String(args[0])));
        if (kind === "tap") {
            for (const key of args) {
                const code = kc(String(key));
                if (code > 0 && code < 0x100) out.push(1, 1, code);
                else if (code >= 0x100) out.push(1, 5, code & 0xff, code >> 8);
            }
        }
    }
    return out;
}

export function seedBoard(): FakeBoardState {
    const kc = keycodeParser();
    const state = blankBoard();
    state.keymap = seedKeymap(kc);

    DEMO_FEATURES.combo.forEach((c, i) => {
        const o = i * COMBO_SIZE;
        c.keys.forEach((k, j) => put16(state.combo, o + j * 2, kc(k)));
        put16(state.combo, o + 8, kc(c.output));
        put16(state.combo, o + 10, (c.on ? COMBO_ENABLED : 0) | (c.combo_term & 0x7fff));
    });

    DEMO_FEATURES.tap_dance.forEach((t, i) => {
        const o = i * TAP_DANCE_SIZE;
        [t.on_tap, t.on_hold, t.on_double_tap, t.on_tap_hold].forEach((k, j) => put16(state.tapDance, o + j * 2, kc(k)));
        put16(state.tapDance, o + 8, (t.on ? TAP_DANCE_ENABLED : 0) | (t.tapping_term & 0x7fff));
    });

    // Two simple macros: tap A, and a line of text. (DEMO_FEATURES' second macro
    // has multi-key taps and delays a file can hold; the board stores the plain kind.)
    const macros = [macroBytes([["tap", "KC_A"]], kc), macroBytes([["text", "hello world"]], kc)];
    let offset = 0;
    for (const m of macros) {
        state.macros.set(m, offset);
        offset += m.length + 1; // and its terminator
    }

    // Shift+Backspace sends Delete, on every layer
    put16(state.keyOverride, 0, kc("KC_BSPACE"));
    put16(state.keyOverride, 2, kc("KC_DELETE"));
    state.keyOverride.set([0xff, 0xff, 0, 0, 0x22, 0, 0x22, KEY_OVERRIDE_ENABLED | 0x07], 4);

    for (const [type, names] of Object.entries(SEED_NAMES)) {
        for (const [index, name] of Object.entries(names)) putLabel(state.labels[Number(type)], Number(index), name);
    }

    // Fragment selections from the default layout: 5-key fingers (option 0),
    // each thumb cluster (option 0); the pointing slots follow detection.
    state.fragments.fill(0, 0, FRAGMENT_INSTANCE_COUNT);
    return state;
}
