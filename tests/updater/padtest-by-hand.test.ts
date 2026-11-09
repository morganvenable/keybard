// TEST BUILD ONLY: the test build's by-hand download returns the carried files, matching their pins.
import { describe, expect, it } from "vitest";
import { CARRIED_RELEASES } from "@/constants/firmware-releases";
import { carriedBytes } from "@/features/firmware/file-bytes";
import { sha256Hex } from "@/services/updater/svup";

describe.runIf(import.meta.env.VITE_PADTEST === "1")("padtest by-hand download", () => {
    it("offers every carried file from memory, matching its pin", async () => {
        expect(CARRIED_RELEASES.map((r) => r.tag)).toEqual(["x4.5-padtest4", "x4.5"]);
        for (const r of CARRIED_RELEASES) {
            const bytes = await carriedBytes(r, { fetcher: (async () => { throw new Error("no network"); }) as unknown as typeof fetch, paranoid: true });
            expect(bytes).not.toBeNull();
            expect(await sha256Hex(bytes!)).toBe(r.file.sha256);
        }
    });
});
