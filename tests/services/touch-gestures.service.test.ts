import { describe, expect, it, vi } from "vitest";
import {
    CMD_SVIL_TOUCH_GESTURES, DEFAULT_TOUCH_GESTURES, TouchGesturesService, decodeTouchGestures,
    encodeTouchGestures, gestureChoice, problems, supportsTouchGestures, withGestureChoice,
} from "../../src/services/touch-gestures.service";

// The firmware's defaults, byte for byte (sval-qmk azoteq/touch_gestures.c tg_defaults).
const DEFAULT_PAYLOAD = [0x08, 0x13, 12, 20, 40, 60, 0, 8, 6, 0x4f, 0x09, 0x50, 0x09, 0x2b, 0x08, 0x07, 0x08, 0xd9, 0x01, 0xda, 0x01];

describe("touch gestures payload v1", () => {
    it("encodes the defaults exactly like the firmware", () => {
        expect(encodeTouchGestures(DEFAULT_TOUCH_GESTURES)).toEqual(DEFAULT_PAYLOAD);
        expect(decodeTouchGestures(DEFAULT_PAYLOAD)).toEqual(DEFAULT_TOUCH_GESTURES);
    });

    it("round-trips owners, options and nibbles", () => {
        const c = { ...DEFAULT_TOUCH_GESTURES, scrollOwner: "chip" as const, pinchOwner: "firmware" as const, spanPads: false, hostAlwaysMerge: true, sustainMin: 2, swipeFingers: 4 };
        const p = encodeTouchGestures(c);
        expect(p[0]).toBe(0x01 | 0x04 | 0x10);
        expect(p[1]).toBe(0x24);
        expect(decodeTouchGestures(p)).toEqual(c);
    });

    it("maps Off to the firmware owning a gesture with no outputs", () => {
        const off = withGestureChoice(DEFAULT_TOUCH_GESTURES, "swipe", "off");
        expect(off.swipeOwner).toBe("firmware");
        expect(off.keycodes.slice(0, 4)).toEqual([0, 0, 0, 0]);
        expect(off.keycodes.slice(4)).toEqual(DEFAULT_TOUCH_GESTURES.keycodes.slice(4));
        expect(gestureChoice(off, "swipe")).toBe("off");
        expect(gestureChoice(off, "pinch")).toBe("windows");
        const back = withGestureChoice(off, "swipe", "firmware");
        expect(back.keycodes).toEqual(DEFAULT_TOUCH_GESTURES.keycodes);
        expect(gestureChoice(back, "swipe")).toBe("firmware");
        const custom = { ...DEFAULT_TOUCH_GESTURES, pinchOwner: "firmware" as const, keycodes: [1, 2, 3, 4, 5, 6] };
        expect(withGestureChoice(custom, "pinch", "windows").keycodes).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it("flags values the board would refuse", () => {
        expect(problems(DEFAULT_TOUCH_GESTURES)).toEqual([]);
        expect(problems({ ...DEFAULT_TOUCH_GESTURES, sustainMin: 4 })).toHaveLength(1);
        expect(problems({ ...DEFAULT_TOUCH_GESTURES, swipeRepeatMm: 2 })).toHaveLength(1);
        expect(problems({ ...DEFAULT_TOUCH_GESTURES, swipeMm: 99 })).toHaveLength(1);
    });

    it("is advertised by feature_flags2 bit 4", () => {
        expect(supportsTouchGestures(0x0f)).toBe(false);
        expect(supportsTouchGestures(0x1f)).toBe(true);
        expect(supportsTouchGestures(undefined)).toBe(false);
    });
});

describe("TouchGesturesService", () => {
    // sendSvil resolves with the reply after the wrapper and protocol byte: [0x2E][sub][status]...
    const usb = (reply: number[]) => ({ sendSvil: vi.fn().mockResolvedValue(new Uint8Array(reply)) });

    it("GET reads the payload after sub, status, version and length", async () => {
        const fake = usb([CMD_SVIL_TOUCH_GESTURES, 0, 0, 1, 21, ...DEFAULT_PAYLOAD]);
        const c = await new TouchGesturesService(fake as any).get();
        expect(c).toEqual(DEFAULT_TOUCH_GESTURES);
        expect(fake.sendSvil).toHaveBeenCalledWith(CMD_SVIL_TOUCH_GESTURES, [0], { uint8: true });
    });

    it("SET sends version, length and the payload, and reports a refusal", async () => {
        const ok = usb([CMD_SVIL_TOUCH_GESTURES, 1, 0]);
        await new TouchGesturesService(ok as any).set(DEFAULT_TOUCH_GESTURES);
        expect(ok.sendSvil).toHaveBeenCalledWith(CMD_SVIL_TOUCH_GESTURES, [1, 1, 21, ...DEFAULT_PAYLOAD], { uint8: true });
        const refused = usb([CMD_SVIL_TOUCH_GESTURES, 1, 2]);
        await expect(new TouchGesturesService(refused as any).set(DEFAULT_TOUCH_GESTURES)).rejects.toThrow(/out of range/);
    });

    it("STATUS decodes the live readout", async () => {
        const fake = usb([CMD_SVIL_TOUCH_GESTURES, 3, 0, 0x82, 1, 5, 2, 0, 1, 0, 3, 0xff]);
        const s = await new TouchGesturesService(fake as any).status();
        expect(s).toEqual({ mode: "unified", handingBack: true, claimed: true, lastGesture: "Pinch out", outputs: 2, claims: 1, contactsLeft: 3, contactsRight: null });
    });
});
