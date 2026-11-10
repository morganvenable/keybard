// Put a .svil back on the connected board through the import path: the preflight, then
// syncWithKeyboard, with no review dialog. Returns what the preflight trimmed. A backup taken
// before an update also puts the board's touchpad mode back (board-state.ts), written at once.
//
// The plan is made against the board as read just now, never against the layout Keybard holds
// in memory: after an update or a reset the board holds its defaults, whatever the editor last
// showed. After the writes the board is read again and compared with the file; what didn't
// land is written once more, and what still differs then fails the restore by name.

import { fileService } from "@/services/file.service";
import { prepareImport } from "@/services/import-preflight";
import type { KeyboardInfo } from "@/types/keyboard.types";
import type { PendingChange } from "@/services/changes.service";
import type { RestoreReport } from "@/services/updater/flow";
import { customValueLabel, qmkSettingLabel } from "@/utils/setting-labels";
import { boardStateFromSvil, restoreBoardState, TouchpadModeNotRestored, type BoardStateTarget } from "./board-state";

type Queue = (desc: string, cb: () => Promise<void>, metadata?: Partial<PendingChange>) => Promise<void>;

export interface LandTarget {
    queue: Queue;
    commit: () => Promise<boolean>;
    /** Read the whole board as it is now (services/board-read.ts). */
    readBoard: () => Promise<KeyboardInfo>;
}

export interface RestoreTarget extends LandTarget {
    setKeyboard: (kb: KeyboardInfo) => void;
    /**
     * The board now holds this layout: no pending edits are left, so a later reconnect
     * asks nothing and leaving the page doesn't warn. (A commit with nothing to write,
     * or with differences only Keybard keeps, would otherwise leave the editor dirty.)
     */
    markSaved?: (kb: KeyboardInfo) => void;
    /** Board state into the draft and the loaded copy: the touchpad mode the backup recorded. */
    applyBoardState?: BoardStateTarget["applyBoardState"];
    readPointing?: BoardStateTarget["readPointing"];
}

/** The board didn't keep part of a layout after it was written twice. */
export class LayoutNotLanded extends Error {
    constructor(readonly missing: string[], readonly board: KeyboardInfo) {
        super(`The keyboard didn't keep part of the layout: ${missing.join(", ")}. Try again, or restore it from Backups.`);
        this.name = "LayoutNotLanded";
    }
}

interface PlannedWrite { desc: string; cb: () => Promise<void>; metadata?: Partial<PendingChange> }

type RestoreModules = {
    importService: typeof import("@/services/import.service")["importService"];
    keyboardService: typeof import("@/services/keyboard.service")["keyboardService"];
};
let restoreModules: Promise<RestoreModules> | null = null;

/**
 * The code a restore runs, loaded once. The update sheet loads it when it opens, and an
 * update that restores starts only once it has: after the board restarts, a page whose
 * site has since been redeployed can no longer fetch its old chunks, and the restore
 * would fail with the board on its defaults. A failed load is forgotten, so the next
 * call (Try again opens the sheet again) fetches it afresh.
 */
export function loadRestoreModules(): Promise<RestoreModules> {
    restoreModules ??= Promise.all([import("@/services/import.service"), import("@/services/keyboard.service")])
        .then(([i, k]) => ({ importService: i.importService, keyboardService: k.keyboardService }))
        .catch((error: unknown) => {
            restoreModules = null;
            throw error;
        });
    return restoreModules;
}

/** The writes that would make `board` hold `wanted` (the import's own comparison). */
export async function planWrites(wanted: KeyboardInfo, board: KeyboardInfo): Promise<PlannedWrite[]> {
    const { importService, keyboardService } = await loadRestoreModules();
    const writes: PlannedWrite[] = [];
    await importService.syncWithKeyboard(wanted, board, async (desc, cb, metadata) => { writes.push({ desc, cb, metadata }); }, { keyboardService });
    return writes;
}

/** Saves follow the writes they save: on their own they change nothing. */
const changesSomething = (w: PlannedWrite) => {
    const key = w.metadata?.writeKey ?? "";
    return key !== "save-svil" && !key.startsWith("custom-save:");
};

const KINDS: Array<[test: (w: PlannedWrite) => boolean, one: string, many: string]> = [
    [(w) => w.metadata?.type === "key" && w.metadata.layer !== undefined, "key", "keys"],
    [(w) => w.metadata?.writeKey === "macros", "the macros", "the macros"],
    [(w) => w.metadata?.type === "combo", "combo", "combos"],
    [(w) => w.metadata?.type === "tapdance", "tap dance", "tap dances"],
    [(w) => w.metadata?.type === "override", "key override", "key overrides"],
    [(w) => !!w.metadata?.writeKey?.startsWith("altrepeat:"), "alt repeat key", "alt repeat keys"],
    [(w) => !!w.metadata?.writeKey?.startsWith("leader:"), "leader sequence", "leader sequences"],
    [(w) => !!w.metadata?.writeKey?.startsWith("label:"), "name", "names"],
    [(w) => !!w.metadata?.writeKey?.startsWith("fragment:"), "hardware position", "hardware positions"],
    [(w) => !!w.metadata?.writeKey?.startsWith("setting:"), "QMK setting", "QMK settings"],
    [(w) => !!w.metadata?.writeKey?.startsWith("custom:"), "keyboard setting", "keyboard settings"],
];

/** What the writes cover, for people: ["744 keys", "3 combos"]. */
export function describeWrites(writes: PlannedWrite[]): string[] {
    const out: string[] = [];
    const left = writes.filter(changesSomething);
    for (const [test, one, many] of KINDS) {
        const n = left.filter(test).length;
        if (!n) continue;
        out.push(one.startsWith("the ") ? one : `${n} ${n === 1 ? one : many}`);
    }
    const known = left.filter((w) => KINDS.some(([test]) => test(w))).length;
    if (left.length > known) out.push(`${left.length - known} other ${left.length - known === 1 ? "entry" : "entries"}`);
    return out;
}

/** The keymap, macros and tables: a restore that doesn't land these failed. */
const layoutPart = (w: PlannedWrite) => KINDS.slice(0, 7).some(([test]) => test(w));

/**
 * A part the read missed (a QMK settings or custom values read that failed twice) is
 * unread, never different: nothing about the board's values follows from it.
 */
const readIn = (board: KeyboardInfo) => (w: PlannedWrite) => {
    const key = w.metadata?.writeKey ?? "";
    if (key.startsWith("custom:") || key.startsWith("custom-save:")) return board.custom_values !== undefined;
    if (key.startsWith("setting:")) return board.settings !== undefined;
    return true;
};

/** What a setting the board didn't keep is called, for the notes. */
function settingName(w: PlannedWrite, menus: KeyboardInfo["menus"]): string {
    const key = w.metadata?.writeKey ?? "";
    if (key.startsWith("setting:")) return qmkSettingLabel(Number(key.slice("setting:".length)));
    if (key.startsWith("custom:")) return customValueLabel(key.slice("custom:".length), menus);
    return describeWrites([w])[0] ?? w.desc;
}

export interface Landed {
    /** The board as last read. */
    board: KeyboardInfo;
    /** Settings, custom values, names and hardware positions the board adjusted or didn't keep, by name. */
    notKept: string[];
    /** Settings written from the file that the last read couldn't read back, by name. */
    unchecked: string[];
}

/**
 * The board to plan writes against: a part it couldn't read has nothing to compare with, so
 * every value the file has for it is written (with no `settings`, the import would write none).
 */
const toPlanOn = (board: KeyboardInfo): KeyboardInfo => (board.settings === undefined ? { ...board, settings: {} } : board);

/**
 * Make the board hold `wanted`, starting from `board` as just read: write what differs,
 * read the board back, write what still differs once more, and read it again. A read that
 * fails is tried once more. Throws LayoutNotLanded when keys, macros or tables are still
 * different, naming them, or an Error when a write itself fails. Settings and custom values
 * the board adjusts or doesn't keep (the firmware clamps or ignores some) come back in
 * `notKept`; ones the last read couldn't read come back in `unchecked`.
 */
export async function landLayout(wanted: KeyboardInfo, board: KeyboardInfo, t: LandTarget): Promise<Landed> {
    const read = () => t.readBoard().catch(() => t.readBoard());
    const done = (current: KeyboardInfo): Landed => ({ board: current, notKept: [], unchecked: [] });
    let current = board;
    for (let attempt = 0; attempt < 2; attempt++) {
        const writes = await planWrites(wanted, toPlanOn(current));
        if (attempt > 0 && !writes.some(changesSomething)) return done(current);
        await Promise.all(writes.map((w) => t.queue(w.desc, w.cb, { ...w.metadata, deferCommit: true })));
        if (!(await t.commit())) throw new Error("Some of the layout couldn't be written.");
        if (!writes.some(changesSomething)) return done(current);
        current = await read();
    }
    // Only the final comparison leaves unread parts out: they are unchecked, not different.
    const all = (await planWrites(wanted, toPlanOn(current))).filter(changesSomething);
    const left = all.filter(readIn(current));
    const failed = left.filter(layoutPart);
    if (failed.length) throw new LayoutNotLanded(describeWrites(failed), current);
    const menus = wanted.menus ?? current.menus;
    const names = (ws: PlannedWrite[]) => [...new Set(ws.map((w) => settingName(w, menus)))];
    return { board: current, notKept: names(left), unchecked: names(all.filter((w) => !readIn(current)(w))) };
}

/**
 * What the editor shows and marks saved after a landed layout: the keys and tables the board
 * now holds (they equal the file), with the settings and custom values as read back.
 */
export function asLanded(planned: KeyboardInfo, landed: Landed): KeyboardInfo {
    if (!landed.notKept.length) return planned;
    return { ...planned, settings: landed.board.settings ?? planned.settings, custom_values: landed.board.custom_values ?? planned.custom_values };
}

export async function restoreLayoutToBoard(svil: string, t: RestoreTarget): Promise<RestoreReport> {
    const imported = await fileService.loadFile(new File([svil], "backup.svil", { type: "application/json" }));
    const board = await t.readBoard();
    const plan = prepareImport(imported, board);
    if (plan.errors.length) throw new Error(plan.errors.join(" "));
    t.setKeyboard(plan.keyboard);
    let landed: Landed;
    try {
        landed = await landLayout(plan.keyboard, board, t);
    } catch (error) {
        // Show what the board holds, never a layout it didn't take.
        if (error instanceof LayoutNotLanded) {
            t.setKeyboard(error.board);
            t.markSaved?.(error.board);
        }
        throw error;
    }
    // Marked saved as read back: a setting the board adjusted is never left as an unsaved edit.
    const shown = asLanded(plan.keyboard, landed);
    if (shown !== plan.keyboard) t.setKeyboard(shown);
    t.markSaved?.(shown);
    const report: RestoreReport = { trimmed: plan.warnings, replaced: plan.replaced, unavailable: plan.unavailable, notKept: landed.notKept, unchecked: landed.unchecked };
    // The layout is back either way: a mode that didn't go back carries the layout's notes.
    if (t.applyBoardState) {
        const { keyboardService } = await loadRestoreModules();
        try {
            await restoreBoardState(boardStateFromSvil(svil), { keyboard: board, applyBoardState: t.applyBoardState, readPointing: t.readPointing ?? ((probe) => keyboardService.getPointingHardware(probe)) });
        } catch (error) {
            if (error instanceof TouchpadModeNotRestored) error.report = report;
            throw error;
        }
    }
    return report;
}
