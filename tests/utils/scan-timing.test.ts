import { describe, expect, it } from "vitest";
import { effectiveWaitUs, readBackKeys, timingWrites, withEffectiveTiming } from "../../src/utils/scan-timing";

describe("scan timing shown as the board runs it", () => {
    it("fills a 0 wait in from the turbo table (older firmware)", () => {
        expect(effectiveWaitUs(0, 6)).toBe(15);
        expect(effectiveWaitUs(0, undefined)).toBe(90);
        expect(effectiveWaitUs(0, 0xff)).toBe(90);
        expect(effectiveWaitUs(200, 6)).toBe(200);
        const shown = withEffectiveTiming(new Map([["id_turbo_scan", 6], ["id_scan_prewait_us", 0], ["id_scan_postwait_us", 120]]));
        expect(shown.get("id_scan_prewait_us")).toBe(15);
        expect(shown.get("id_scan_postwait_us")).toBe(120);
    });

    it("leaves the values alone when no wait is 0", () => {
        const values = new Map([["id_scan_prewait_us", 45], ["id_scan_postwait_us", 5]]);
        expect(withEffectiveTiming(values)).toBe(values);
    });

    it("writes the other wait too while it is still 0 on the board", () => {
        const values = new Map([["id_turbo_scan", 6], ["id_scan_prewait_us", 0], ["id_scan_postwait_us", 0]]);
        expect(timingWrites("id_scan_prewait_us", 40, values)).toEqual([["id_scan_prewait_us", 40], ["id_scan_postwait_us", 15]]);
        expect(timingWrites("id_scan_postwait_us", 40, new Map([["id_scan_prewait_us", 30], ["id_scan_postwait_us", 90]])))
            .toEqual([["id_scan_postwait_us", 40]]);
        expect(timingWrites("id_left_dpi", 3, values)).toEqual([["id_left_dpi", 3]]);
    });

    it("reads back what the board may change", () => {
        expect(readBackKeys("id_scan_prewait_us")).toEqual(["id_scan_prewait_us", "id_scan_postwait_us"]);
        expect(readBackKeys("id_automouse_timeout_ms")).toEqual(["id_automouse_timeout_ms", "id_automouse_no_timeout"]);
        expect(readBackKeys("id_left_dpi")).toEqual([]);
    });
});
