/**
 * A board that stores what Keybard writes as the firmware does: raw bytes per
 * table entry, per custom value and per key. Dependency-free, so both the unit
 * tests (vitest) and the UX flow tests (Playwright, in Node) can drive it.
 *
 * Commands follow Sval protocol 3 (16-bit table indices, TABLE_SCAN) and VIA:
 *   Sval  0x01/0x02 tap dance get/set   [idx:2][tap:2][hold:2][dtap:2][thold:2][term:2]
 *         0x03/0x04 combo get/set       [idx:2][k0:2][k1:2][k2:2][k3:2][out:2][options:2]
 *         0x21 TABLE_SCAN               [table][start:2] -> [cmd][table][found][idx:2][entry]
 *         0x0b SAVE
 *   VIA   0x05 set keycode              [layer][row][col][kc:2 BE]
 *         0x13 keymap set buffer        [offset:2 BE][size][kc:2 BE ...]
 *         0x07/0x08/0x09 custom value set/get/save [channel][id][data...]
 */
export const SVAL_TD_GET = 0x01, SVAL_TD_SET = 0x02, SVAL_COMBO_GET = 0x03, SVAL_COMBO_SET = 0x04;
export const SVAL_SAVE = 0x0b, SVAL_TABLE_SCAN = 0x21;
export const VIA_SET_KEYCODE = 0x05, VIA_KEYMAP_SET_BUFFER = 0x13, VIA_CUSTOM_SET = 0x07, VIA_CUSTOM_GET = 0x08, VIA_CUSTOM_SAVE = 0x09;

const TABLES = { 0: { cmdGet: SVAL_TD_GET, cmdSet: SVAL_TD_SET, size: 10 }, 1: { cmdGet: SVAL_COMBO_GET, cmdSet: SVAL_COMBO_SET, size: 12 } } as const;

export const le16 = (v: number) => [v & 0xff, (v >> 8) & 0xff];

export interface ByteBoardShape { tapdances: number; combos: number; layers: number; rows: number; cols: number }

export class ByteBoard {
    /** Tap dances then combos, by scan table id (0, 1). */
    tables: Record<0 | 1, number[][]>;
    /** Custom values by `channel:id`. */
    custom = new Map<string, number[]>();
    keymap: number[];
    /** Every write the board took, in order (`td:0`, `combo:0`, `custom:0:2`, `key:14:0:3`, `save`, `custom-save:0`). */
    writes: string[] = [];

    constructor(public shape: ByteBoardShape) {
        this.tables = { 0: Array.from({ length: shape.tapdances }, () => new Array(10).fill(0)), 1: Array.from({ length: shape.combos }, () => new Array(12).fill(0)) };
        this.keymap = new Array(shape.layers * shape.rows * shape.cols).fill(0);
    }

    /** The reply to a Sval command, as `sendSvil` returns it: from the command echo on. */
    sval(cmd: number, args: number[]): number[] {
        if (cmd === SVAL_TABLE_SCAN) {
            const [table, lo, hi] = args;
            const rows = this.tables[table as 0 | 1];
            const start = lo | (hi << 8);
            const next = rows ? rows.findIndex((entry, i) => i >= start && entry.some(b => b !== 0)) : -1;
            if (next < 0) return [cmd, table, 0, 0, 0];
            return [cmd, table, 1, ...le16(next), ...rows[next]];
        }
        for (const [id, t] of Object.entries(TABLES)) {
            const rows = this.tables[Number(id) as 0 | 1];
            const index = args[0] | (args[1] << 8);
            if (cmd === t.cmdGet) return [cmd, ...le16(index), ...(rows[index] ?? new Array(t.size).fill(0))];
            if (cmd === t.cmdSet) {
                if (index >= rows.length) return [cmd, 1];
                rows[index] = args.slice(2, 2 + t.size);
                this.writes.push(`${id === "0" ? "td" : "combo"}:${index}`);
                return [cmd, 0];
            }
        }
        if (cmd === SVAL_SAVE) { this.writes.push("save"); return [cmd, 0]; }
        throw new Error(`ByteBoard: unmocked Sval command 0x${cmd.toString(16)}`);
    }

    /** The full reply to a VIA command, from the command echo on. */
    via(cmd: number, args: number[]): number[] {
        if (cmd === VIA_SET_KEYCODE) {
            const [layer, row, col, hi, lo] = args;
            this.keymap[(layer * this.shape.rows + row) * this.shape.cols + col] = (hi << 8) | lo;
            this.writes.push(`key:${layer}:${row}:${col}`);
            return [cmd, ...args];
        }
        if (cmd === VIA_KEYMAP_SET_BUFFER) {
            const [hi, lo, size, ...data] = args;
            const first = ((hi << 8) | lo) / 2;
            for (let i = 0; i < size / 2; i++) {
                this.keymap[first + i] = (data[i * 2] << 8) | data[i * 2 + 1];
                const layer = Math.floor((first + i) / (this.shape.rows * this.shape.cols)), at = (first + i) % (this.shape.rows * this.shape.cols);
                this.writes.push(`key:${layer}:${Math.floor(at / this.shape.cols)}:${at % this.shape.cols}`);
            }
            return [cmd, ...args];
        }
        if (cmd === VIA_CUSTOM_SET) {
            const [channel, id, ...data] = args;
            this.custom.set(`${channel}:${id}`, data);
            this.writes.push(`custom:${channel}:${id}`);
            return [cmd, ...args];
        }
        if (cmd === VIA_CUSTOM_GET) {
            const [channel, id] = args;
            return [cmd, channel, id, ...(this.custom.get(`${channel}:${id}`) ?? [0, 0])];
        }
        if (cmd === VIA_CUSTOM_SAVE) { this.writes.push(`custom-save:${args[0]}`); return [cmd, ...args]; }
        throw new Error(`ByteBoard: unmocked VIA command 0x${cmd.toString(16)}`);
    }

    /** Tap dance entry bytes as the firmware stores them. */
    static tapdance(tap: number, hold: number, doubletap: number, taphold: number, term: number, enabled: boolean) {
        return [...le16(tap), ...le16(hold), ...le16(doubletap), ...le16(taphold), ...le16((term & 0x7fff) | (enabled ? 0x8000 : 0))];
    }

    /** Combo entry bytes as the firmware stores them (key order kept). */
    static combo(keys: number[], output: number, options: number) {
        const k = [...keys, 0, 0, 0, 0].slice(0, 4);
        return [...k.flatMap(le16), ...le16(output), ...le16(options)];
    }
}
