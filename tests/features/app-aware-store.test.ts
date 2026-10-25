import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseProto } from "@/features/app-aware/proto";
import {
    ALL, DEBOUNCE_MS, addApp, applyFront, clearHold, flicker, getState, manualLayer, nativeHold, reportFront,
    resetAppAwareForTests, resolveHold, selectApp, setHold, setKeysHeld, setLocked, setOverlay, setPaused, setTestAs,
    undoWarning, updateApp,
} from "@/features/app-aware/store";
import { statusSentence } from "@/features/app-aware/BoardStatus";
import { COMMON_ACTIONS, shortcutText } from "@/features/app-aware/catalog";

const [UNDO, , COPY] = COMMON_ACTIONS;

beforeEach(() => {
    vi.useFakeTimers();
    resetAppAwareForTests({ on: true, supported: true, overlay: true });
});
afterEach(() => vi.useRealTimers());

describe("app-aware prototype flag", () => {
    it("is off without ?proto=app-aware", () => {
        expect(parseProto("?demo")).toBeNull();
        expect(parseProto("?proto=other")).toBeNull();
    });
    it("reads looks, selector and states", () => {
        const p = parseProto("?proto=app-aware&look=c&selector=b&os=mac&board=old&overlay=off")!;
        expect(p).toMatchObject({ look: "c", selector: "b", os: "mac", boardSupports: false, overlay: false });
        expect(parseProto("?proto=app-aware&look=zzz")!.look).toBe("a");
    });
});

describe("hold resolution", () => {
    it("this app, then All apps, then the key's own hold", () => {
        addApp("figma");
        const pos = "0:2:0";
        expect(resolveHold("figma", pos, null).source).toBe("none");
        const native = nativeHold(null, "LCTL_T(KC_A)");
        expect(resolveHold("figma", pos, native)).toMatchObject({ source: "native" });
        selectApp(ALL);
        setHold(pos, UNDO);
        expect(resolveHold("figma", pos, native)).toMatchObject({ source: "all", hold: UNDO });
        selectApp("figma");
        setHold(pos, COPY);
        expect(resolveHold("figma", pos, native)).toMatchObject({ source: "app", hold: COPY });
        clearHold(pos);
        expect(resolveHold("figma", pos, native).source).toBe("all");
    });

    it("warns, not blocks, on a hold for a key that repeats; Undo puts it back", () => {
        setHold("0:5:1", UNDO, "KC_BSPACE");
        expect(getState().warning?.key).toBe("KC_BSPACE");
        expect(resolveHold(ALL, "0:5:1", null).hold).toEqual(UNDO);
        undoWarning();
        expect(resolveHold(ALL, "0:5:1", null).source).toBe("none");
    });

    it("names the primary modifier per platform", () => {
        expect(shortcutText("PRI(KC_Z)", "win")).toBe("Ctrl Z");
        expect(shortcutText("PRI(LSFT(KC_E))", "mac")).toBe("Cmd Shift E");
    });
});

describe("base layer rules", () => {
    beforeEach(() => {
        addApp("elden");
        updateApp("elden", { baseLayer: 3 });
        addApp("figma");
    });

    it("entering a linked app sets its layer; any other app means home", () => {
        applyFront("elden");
        expect(getState().boardLayer).toBe(3);
        applyFront("figma");
        expect(getState().boardLayer).toBe(0);
    });

    it("ignores switches shorter than the debounce", () => {
        applyFront("elden");
        flicker("slack");
        vi.advanceTimersByTime(DEBOUNCE_MS * 3);
        expect(getState().front).toBe("elden");
        expect(getState().boardLayer).toBe(3);
        reportFront("figma");
        vi.advanceTimersByTime(DEBOUNCE_MS + 1);
        expect(getState().front).toBe("figma");
    });

    it("waits until no keys are held", () => {
        setKeysHeld(true);
        applyFront("elden");
        expect(getState().boardLayer).toBe(0);
        expect(getState().pendingLayer).toBe(3);
        expect(statusSentence(getState())?.kind).toBe("wait");
        setKeysHeld(false);
        expect(getState().boardLayer).toBe(3);
    });

    it("a manual change wins until the next app change", () => {
        applyFront("elden");
        manualLayer(1);
        expect(getState().boardLayer).toBe(1);
        applyFront("figma");
        expect(getState().boardLayer).toBe(0);
        expect(getState().manual).toBeNull();
    });

    it("lock screen, lost contact and Pause mean home", () => {
        applyFront("elden");
        setLocked(true);
        expect(getState().boardLayer).toBe(0);
        setLocked(false);
        expect(getState().boardLayer).toBe(3);
        setOverlay(false);
        expect(getState().boardLayer).toBe(0);
        setOverlay(true);
        setPaused(true);
        expect(getState().boardLayer).toBe(0);
        expect(statusSentence(getState())?.kind).toBe("paused");
    });

    it("Test as applies the app's base layer and says so", () => {
        setTestAs("elden");
        expect(getState().boardLayer).toBe(3);
        expect(statusSentence(getState())?.text).toMatch(/^Testing as Elden Ring/);
        setTestAs(null);
        expect(getState().boardLayer).toBe(0);
    });

    it("states why the board is on a layer", () => {
        applyFront("elden");
        expect(statusSentence(getState())?.text).toMatch(/because Elden Ring is in front$/);
    });
});
