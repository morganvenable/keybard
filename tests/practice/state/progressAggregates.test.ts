import { afterEach, describe, expect, it, vi } from 'vitest';
import { boardGeometry } from '@/features/practice/keymap/geometry';
import { resolveKeymap } from '@/features/practice/keymap/resolver';
import { hasDoubleSouth } from '@/features/practice/lessons/scope';
import type { PracticeController } from '@/features/practice/state/controller';
import {
    charsOnLayer, fingersGrid, groupSeries, heatLevel, heatmapKeys, historyPage, inferredOnlyChars, layerRows, mostlyInferred, physicalTotals, thumbRows,
    usageQuartiles,
} from '@/features/practice/state/progressAggregates';
import { periodView } from '@/features/practice/state/progressView';
import type { StoredResult } from '@/features/practice/store/db';
import { MemoryPracticeStore } from '@/features/practice/store/memory';
import type { ResultRecord } from '@/features/practice/types';
import { keyService } from '@/services/key.service';
import { svalDefault } from '../fixtures/boards';
import { record } from '../fixtures/records';
import { resetHarness, startController } from '../ui/harness';

// The Progress page's physical sections (spec §5.0.2, §5.8, §12 M4): heat levels and their thresholds, the
// heatmap's keys, the Fingers grid, Thumbs, Layers, History and the Inferred rules.

const board = svalDefault();
const resolution = resolveKeymap({ keymap: board.keymap!, rows: board.rows, cols: board.cols });
const places = boardGeometry(board);
const cp = (s: string) => s.codePointAt(0)!;
const at = (ch: string) => resolution.primary(cp(ch))!.index;
const stringify = (code: number) => keyService.stringify(code);
const MO1 = 32, LT1 = 3, SPACE = at(' ');

let nextId = 1;
function stored(r: ResultRecord): StoredResult {
    return { ...r, id: nextId++ };
}

afterEach(() => resetHarness());

describe('heat levels (§5.8 thresholds)', () => {
    it('Speed is confidence: far < 0.5 ≤ mid < 0.75 ≤ near < 1 ≤ target', () => {
        expect([0.2, 0.5, 0.74, 0.75, 0.99, 1, 1.4].map((v) => heatLevel('speed', v))).toEqual(['far', 'mid', 'mid', 'near', 'near', 'target', 'target']);
    });

    it('Accuracy: far < 90% ≤ mid < 95% ≤ near < 98% ≤ target', () => {
        expect([0.8, 0.9, 0.949, 0.95, 0.979, 0.98, 1].map((v) => heatLevel('accuracy', v))).toEqual(['far', 'mid', 'mid', 'near', 'near', 'target', 'target']);
    });

    it('Errors: far > 10% ≥ mid > 5% ≥ near > 2% ≥ target', () => {
        expect([0.2, 0.1, 0.06, 0.05, 0.03, 0.02, 0].map((v) => heatLevel('errors', v))).toEqual(['far', 'mid', 'mid', 'near', 'near', 'target', 'target']);
    });

    it('Usage: quartiles of the values shown, on the blue ramp; nothing used is no data', () => {
        const q = usageQuartiles([0.01, 0.02, 0.03, 0.04, 0.05, 0, 0]);
        expect(q).toEqual([0.02, 0.03, 0.04]);
        expect([0.01, 0.02, 0.03, 0.045, 0.05].map((v) => heatLevel('usage', v, q))).toEqual(['use-1', 'use-2', 'use-3', 'use-4', 'use-4']);
        expect(heatLevel('usage', 0, q)).toBe('none');
        expect(heatLevel('speed', null)).toBe('none');
    });
});

describe('physical totals', () => {
    const a = at('a');
    const r1 = stored({ ...record(1000), k: { [`${a}@0`]: { h: 10, m: 1, t: 200, s: 0 }, [`${at('x')}@0`]: { h: 0, m: 0, t: 0, s: 2 } }, r: { [MO1]: { n: 4, t: 150 } } });
    const r2 = stored({ ...record(2000), k: { [`${a}@0`]: { h: 10, m: 0, t: 400, s: 1 } } });

    it('adds up hits, misses, strays, time and reach per key and per key on a layer', () => {
        const totals = physicalTotals([r1, r2]);
        expect(totals.byKeyLayer.get(`${a}@0`)).toMatchObject({ h: 20, m: 1, s: 1, time: 6000, timed: 20 });
        expect(totals.byKey.get(MO1)).toMatchObject({ reachN: 4, reachTime: 600 });
        // Presses: 21 on a, 2 strays on x, 4 MO(1) holds.
        expect(totals.allPresses).toBe(27);
        expect(totals.layers).toEqual([0]);
    });

    it('a heatmap key takes its character stats for Speed and Accuracy and its own samples for Errors and Usage', () => {
        const totals = physicalTotals([r1, r2]);
        const stats = { codePoint: cp('a'), samples: 2, speed: 300, confidence: 0.8, accuracy: 0.95 } as never;
        const keys = heatmapKeys({
            keymap: board.keymap!, resolution, indices: [a, at('x'), at('s')], layer: 0, defaultLayer: 0, totals,
            characters: new Map([[cp('a'), stats]]), targetSpeed: 175,
        });
        expect(keys[0]).toMatchObject({ char: cp('a'), noData: false, values: { speed: 0.8, cpm: 300, accuracy: 0.95 } });
        expect(keys[0].values.errors).toBeCloseTo(2 / 22);
        expect(keys[0].values.usage).toBeCloseTo(21 / 27);
        // x was only ever hit by mistake: no character stats, but its Errors show.
        expect(keys[1]).toMatchObject({ char: cp('x'), stats: null, noData: false, values: { errors: 1, accuracy: null } });
        // s has neither.
        expect(keys[2].noData).toBe(true);
    });

    it('Space uses its key samples; a key transparent on the shown layer has no data there', () => {
        const space = stored({ ...record(3000), k: { [`${SPACE}@0`]: { h: 30, m: 0, t: 240, s: 0 } } });
        const totals = physicalTotals([space]);
        const [key] = heatmapKeys({ keymap: board.keymap!, resolution, indices: [SPACE], layer: 0, defaultLayer: 0, totals, characters: new Map(), targetSpeed: 175 });
        expect(key.values.cpm).toBe(250);
        expect(key.values.speed).toBeCloseTo((60000 / 175) / 240);
        const transparent = board.keymap![1].findIndex((code) => stringify(code) === 'KC_TRNS');
        expect(transparent).toBeGreaterThanOrEqual(0);
        const [ghost] = heatmapKeys({ keymap: board.keymap!, resolution, indices: [transparent], layer: 1, defaultLayer: 0, totals, characters: new Map(), targetSpeed: 175 });
        expect(ghost).toMatchObject({ char: null, noData: true });
    });
});

describe('Fingers and Thumbs (§5.8 items 4–5)', () => {
    it('lays out 8 fingers × C N S E W with no 2S row on the default board, plus Finger totals', () => {
        const a = at('a'); // L-pinky C
        const totals = physicalTotals([stored({ ...record(1), k: { [`${a}@0`]: { h: 10, m: 0, t: 300, s: 0 }, [`${a}@1`]: { h: 5, m: 1, t: 600, s: 0 } } })]);
        const grid = fingersGrid(places, totals, 175, resolution, hasDoubleSouth(places));
        expect(grid.rows).toEqual(['C', 'N', 'S', 'E', 'W']);
        expect(grid.cells.length).toBe(5);
        const cell = grid.cells[0][0]!;
        expect(cell.name).toBe('L-pinky · C');
        expect(cell.indices).toEqual([a]);
        // Every layer of the key: 15 hits, mean time (3000 + 3000) / 15.
        expect(cell.totals).toMatchObject({ h: 15, m: 1 });
        expect(cell.values.cpm).toBeCloseTo(60000 / 400);
        expect(cell.chars).toContain(cp('a'));
        expect(cell.chars).toContain(cp('1'));
        expect(grid.totals[0].name).toBe('L-pinky');
        expect(grid.totals[0].totals.h).toBe(15);
        expect(grid.cells[0][4]!.name).toBe('R-index · C');
    });

    it('a layer key held more than tapped shows its layer reach as Speed', () => {
        const totals = physicalTotals([stored({ ...record(1), r: { [MO1]: { n: 8, t: 180 } }, k: { [`${SPACE}@0`]: { h: 20, m: 0, t: 200, s: 0 } } })]);
        const { left, right } = thumbRows(places, totals, 175, resolution);
        expect(left.map((r) => r.key)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5', 'T6']);
        expect(right.map((r) => r.key)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5', 'T6']);
        const mo = right.find((r) => r.index === MO1)!;
        expect(mo.key).toBe('T5');
        expect(mo.group.values.reachMs).toBe(180);
        expect(mo.group.values.speed).toBeCloseTo((60000 / 175) / 180);
        const space = [...left, ...right].find((r) => r.index === SPACE)!;
        expect(space.group.values.cpm).toBe(300);
        expect(left.find((r) => r.index === LT1)!.key).toBe('T1');
    });
});

describe('Layers, Inferred and History (§5.8 items 6, 8)', () => {
    it('adds character samples up by their path layer, with the reach of the keys holding the layer', () => {
        const r = stored({
            ...record(1, 'me', { '97|0:26:n': { h: 9, m: 1, t: 300 }, '33|1:27:f': { h: 3, m: 1, t: 600 }, '49|1:26:n': { h: 1, m: 0, t: 0 } }),
            r: { [MO1]: { n: 2, t: 200 }, [LT1]: { n: 2, t: 300 } },
        });
        const rows = layerRows([r], board.keymap!, 0, stringify);
        expect(rows.map((l) => l.layer)).toEqual([0, 1]);
        expect(rows[0]).toMatchObject({ characters: 1, reachMs: null, share: 9 / 13 });
        expect(rows[0].cpm).toBeCloseTo(200);
        expect(rows[1]).toMatchObject({ characters: 2, reachMs: 250 });
        expect(rows[1].accuracy).toBeCloseTo(3 / 4);
        expect(rows[1].cpm).toBeCloseTo(100);
    });

    it('Inferred when more than half of the hits came from the keymap; P5 Inferred only per character', () => {
        const keymapOnly = stored(record(1));
        const live = stored({ ...record(2, 'me', { '97|0:26:n': { h: 5, m: 0, t: 200 } }), x: { ...record(2).x, src: 'usb', obs: 20, inf: 0 } });
        expect(mostlyInferred([keymapOnly])).toBe(true);
        expect(mostlyInferred([keymapOnly, live])).toBe(false);
        expect(mostlyInferred([])).toBe(false);
        expect([...inferredOnlyChars([keymapOnly, live])].sort()).toEqual([cp('d'), cp('s')]);
    });

    it('a key’s series can be limited to one layer, matching totals taken for that layer (review R7)', () => {
        const a = stored({ ...record(1), k: { [`${SPACE}@0`]: { h: 10, m: 0, t: 200, s: 0 }, [`${SPACE}@1`]: { h: 10, m: 0, t: 100, s: 0 } } });
        const b = stored({ ...record(2), k: { [`${SPACE}@1`]: { h: 5, m: 0, t: 400, s: 0 } } });
        // Any layer: both lessons, layer 0 and 1 mixed in the first.
        expect(groupSeries([a, b], [SPACE]).length).toBe(2);
        expect(groupSeries([a, b], [SPACE], 0)).toEqual([300]);
        expect(groupSeries([a, b], [SPACE], 1)).toEqual([600, 150]);
    });

    it('charsOnLayer: every character whose primary path is on the layer (review R4)', () => {
        const base = charsOnLayer(resolution, 0);
        const one = charsOnLayer(resolution, 1);
        expect(base).toContain(cp('a'));
        expect(base).toContain(cp('z'));
        expect(base).not.toContain(cp('!'));
        expect(one.length).toBeGreaterThan(0);
        expect(one.every((ch) => resolution.primary(ch)!.layer === 1)).toBe(true);
        expect(new Set([...base, ...one]).size).toBe(base.length + one.length);
    });

    it('History pages newest first, 50 a page', () => {
        const records = Array.from({ length: 120 }, (_, i) => stored(record(i * 1000)));
        const first = historyPage(records, 0);
        expect(first.pages).toBe(3);
        expect(first.rows.length).toBe(50);
        expect(first.rows[0].ts).toBe(119_000);
        expect(first.rows[0]).toMatchObject({ type: 'guided', length: 15, src: 'keymap' });
        expect(first.rows[0].speed).toBeCloseTo(225);
        expect(first.rows[0].accuracy).toBeCloseTo(14 / 15);
        expect(historyPage(records, 2).rows.length).toBe(20);
        expect(historyPage(records, 9).rows[0].ts).toBe(19_000);
    });
});

/** Types the rest of the controller's lesson (Keymap only). */
function finishLesson(c: PracticeController, start: number) {
    const run = c.run!;
    let t = start;
    for (let guard = 0; guard < 3000 && !run.textInput.completed; guard++) {
        c.onInput({ type: 'input', timeStamp: (t += 140 + (guard % 7) * 20), inputType: 'appendChar', codePoint: run.expected!, timeToType: 0 });
    }
}

describe('heatmap values match the Characters table (§12 M4)', () => {
    it('for every practiced key on the base layer, after real lessons', async () => {
        const store = new MemoryPracticeStore();
        const c = await startController({ store, settings: { targetSpeed: 75 } });
        c.setFocused(true);
        for (let lesson = 0; lesson < 3; lesson++) {
            c.resume();
            const before = c.session!.records.length;
            finishLesson(c, 1000 + lesson * 100_000);
            await vi.waitFor(() => expect(c.session!.records.length).toBe(before + 1));
        }
        const s = c.session!;
        const view = periodView(s.lesson, s.records, s.target, (ch) => s.resolution.primary(ch), 'all', Date.now(), {
            tracked: s.trackedLetters, always: new Set(s.languageLetters.map((l) => l.codePoint)),
        });
        const characters = new Map(view.characters.map((ch) => [ch.codePoint, ch]));
        const totals = physicalTotals(view.records);
        const keys = heatmapKeys({
            keymap: board.keymap!, resolution: s.resolution, indices: places.map((p) => p.index), layer: 0, defaultLayer: 0,
            totals, characters, targetSpeed: s.settings.targetSpeed,
        });
        const practiced = keys.filter((k) => k.stats);
        expect(practiced.length).toBeGreaterThanOrEqual(6);
        for (const key of practiced) {
            const row = characters.get(key.char!)!;
            expect(key.values.cpm).toBe(row.speed);
            expect(key.values.accuracy).toBe(row.accuracy);
            expect(key.values.speed).toBe(row.confidence);
        }
        // Every key with samples has a value; the others are the no-data look.
        for (const key of keys) expect(key.noData).toBe(key.stats == null && !totals.byKeyLayer.has(`${key.index}@0`));
    });
});
