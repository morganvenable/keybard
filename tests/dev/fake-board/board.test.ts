// The simulated board keeps its settings in localStorage, like a board keeps them
// in EEPROM, and ?fakeBoard turns it on.
import { afterEach, describe, expect, it } from "vitest";
import { deserializeBoard, loadStoredBoard, serializeBoard, STORAGE_KEY, wipeFakeBoard } from "@/dev/fake-board/board";
import { seedBoard } from "@/dev/fake-board/seed";
import { FakeSvalboardDevice } from "@/dev/fake-board/device";
import { fakeBoardFromSearch } from "@/lib/deepLinks";

afterEach(() => wipeFakeBoard());

describe("stored board", () => {
    it("survives a save and load byte for byte", () => {
        const state = seedBoard();
        state.labels[3][5 * 16] = 0x41;
        state.macros[50000] = 7;
        state.identityName = "Desk";
        const back = deserializeBoard(serializeBoard(state))!;
        expect(back).toEqual(state);
    });

    it("is saved by writes and read back by the next device", async () => {
        const first = new FakeSvalboardDevice({ schedule: (fn) => setImmediate(fn) });
        expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
        // LABEL_SET through the firmware, as Keybard sends it
        await first.open();
        const id = await new Promise<number>((resolve) => {
            first.addEventListener("inputreport", (ev) => {
                const d = new Uint8Array((ev as HIDInputReportEvent).data.buffer);
                resolve((d[25] | (d[26] << 8) | (d[27] << 16) | (d[28] << 24)) >>> 0);
            }, { once: true });
            const boot = new Uint8Array(32);
            boot[0] = 0xdd;
            boot.fill(1, 5, 25);
            void first.sendReport(0, boot);
        });
        if (id === 0) return; // the 1-in-65536 ID the firmware won't accept
        const set = new Uint8Array(32);
        set.set([0xdd, id & 0xff, (id >>> 8) & 0xff, (id >>> 16) & 0xff, id >>> 24, 0xdf, 0x1c, 3, 7, 0, 0x5a]);
        await first.sendReport(0, set);
        expect(loadStoredBoard()!.labels[3][7 * 16]).toBe(0x5a);
        const second = new FakeSvalboardDevice();
        expect(second.state.labels[3][7 * 16]).toBe(0x5a);
    });

    it("starts over from the seed once wiped", () => {
        const device = new FakeSvalboardDevice();
        device.state.combo[0] = 0x99;
        device.forgetSettings();
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
        expect(new FakeSvalboardDevice().state.combo[0]).toBe(seedBoard().combo[0]);
    });
});

describe("?fakeBoard", () => {
    it("is off without the parameter and picks the firmware by its value", () => {
        expect(fakeBoardFromSearch("")).toBeNull();
        expect(fakeBoardFromSearch("?demo")).toBeNull();
        expect(fakeBoardFromSearch("?fakeBoard")).toBe("combo-names");
        expect(fakeBoardFromSearch("?fakeBoard=1&theme=dark")).toBe("combo-names");
        expect(fakeBoardFromSearch("?fakeBoard=old")).toBe("old");
        expect(fakeBoardFromSearch("?fakeBoard=OLD")).toBe("old");
    });
});
