// Layout import, as a user does it on a connected board: Import Layout, pick
// the file, Apply import. Then a power cycle (reload and reconnect) reads the
// board back through Keybard's own readers. The board must hold exactly what the
// file says, and importing the same file again must have nothing left to write.
//
// The two layouts differ in tap dance 0, combo 0 (key order) and the right DPI.
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { connect, openWithByteBoard, parseKeys, setLiveUpdating } from "./import-board";
import { ByteBoard } from "../tests/mocks/byte-board";
import { readbackLayout, RAW, type Version } from "../tests/fixtures/import-readback.fixture";

/** The board's bytes for one layout, encoded with this page's keycode numbers. */
async function seed(page: Page, board: ByteBoard, layout: string) {
    const svil = JSON.parse(layout);
    const names: string[] = [
        ...svil.layout.flat(2),
        ...svil.tap_dance.flatMap((t: Record<string, string>) => [t.on_tap, t.on_hold, t.on_double_tap, t.on_tap_hold]),
        ...svil.combo.flatMap((c: { keys: string[]; output: string }) => [...c.keys, c.output]),
    ];
    const unique = [...new Set(names)];
    const parsed = await parseKeys(page, unique);
    const codes = new Map(unique.map((n, i) => [n, parsed[i]]));
    const code = (name: string) => codes.get(name)!;
    board.keymap = svil.layout.flat(2).map(code);
    board.tables[0] = svil.tap_dance.map((t: Record<string, any>) => ByteBoard.tapdance(code(t.on_tap), code(t.on_hold), code(t.on_double_tap), code(t.on_tap_hold), t.tapping_term, t.on !== false));
    board.tables[1] = svil.combo.map((c: Record<string, any>) => ByteBoard.combo(c.keys.map(code), code(c.output), (c.combo_term & 0x7fff) | (c.on !== false ? 0x8000 : 0)));
    const ids: Record<string, number> = { id_left_dpi: 0, id_left_scroll: 1, id_right_dpi: 2, id_right_scroll: 3 };
    for (const v of svil.custom_values) {
        const layer = /^id_layer(\d+)_color$/.exec(v.key);
        board.custom.set(`0:${layer ? 32 + Number(layer[1]) : ids[v.key]}`, [...v.data]);
    }
    board.writes = [];
}

async function importFile(page: Page, layout: string, name: string) {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Import Layout", exact: true }).first().click();
    await (await chooser).setFiles({ name, mimeType: "application/json", buffer: Buffer.from(layout) });
    const review = page.getByRole("dialog", { name: "Review layout import" });
    await expect(review).toBeVisible();
    await expect(review.getByText(name)).toBeVisible();
    await review.getByRole("button", { name: "Apply import", exact: true }).click();
    await expect(review).toBeHidden({ timeout: 20_000 });
}

test.describe("layout import onto a connected board", () => {
    // Dev-server React warnings from unrelated components; production builds don't log them.
    test.beforeEach(({ allowConsoleError }) => allowConsoleError(/React does not recognize the/));

    for (const [from, to] of [["older", "newer"], ["newer", "older"]] as Array<[Version, Version]>) {
        test(`applying the ${to} layout over the ${from} one: the board reads back as the file`, async ({ page }) => {
            const before = readbackLayout(from), file = readbackLayout(to);
            const board = new ByteBoard({ tapdances: 50, combos: 50, layers: 16, rows: 10, cols: 6 });
            await openWithByteBoard(page, board, before);
            await seed(page, board, before);
            await connect(page);
            await setLiveUpdating(page, true);

            await importFile(page, file, `${to}.svil`);
            await expect.poll(() => board.writes.includes("save")).toBe(true);
            // Exactly the three entries that differ, then one save each.
            expect([...board.writes].sort()).toEqual(["combo:0", "custom-save:0", "custom:0:2", "save", "td:0"]);
            expect(board.tables[0][0]).toEqual(RAW[to].td0);
            expect(board.tables[1][0]).toEqual(RAW[to].combo0);
            expect(board.custom.get("0:2")).toEqual(RAW[to].rightDpi);

            // Every table entry, key and value equals the file's own encoding.
            const expected = new ByteBoard(board.shape);
            await seed(page, expected, file);
            expect(board.tables).toEqual(expected.tables);
            expect(board.keymap).toEqual(expected.keymap);
            expect(Object.fromEntries(board.custom)).toEqual(Object.fromEntries(expected.custom));

            // Power cycle: Keybard reads the board back; the same file now changes nothing.
            board.writes = [];
            await openWithByteBoard(page, board, before);
            await connect(page);
            await setLiveUpdating(page, true);
            await importFile(page, file, `${to}.svil`);
            await page.waitForTimeout(500);
            expect(board.writes).toEqual([]);
        });
    }
});
