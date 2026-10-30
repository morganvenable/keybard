import { describe, it, expect } from 'vitest';
import {
    AUTOMOUSE_CHOICES_MS, boardMenuRefs, firmwareReleaseUrl, migrateCustomValues, nearestAutomouseChoice, nearestTurboIndex,
} from '../../src/services/settings-migrate';
import { prepareImport } from '../../src/services/import-preflight';
import { TURBO_US } from '../../src/utils/scan-timing';
import type { CustomUIMenuItem, CustomValueEntry, KeyboardInfo } from '../../src/types/keyboard.types';

// Synthetic menus shaped like sval.json before and after x4.3 (feat/timing-us-only).
const OLD_MENUS: CustomUIMenuItem[] = [{ label: 'Pointing Device', content: [
    { label: 'Auto Mouse', content: [
        { label: 'Enable Auto Mouse', type: 'toggle', content: ['id_automouse_enable', 0, 4] },
        { showIf: '{id_automouse_enable} == 1', content: [
            { label: 'Layer Timeout', type: 'dropdown', options: ['200 ms', '300 ms', '400 ms', '500 ms', '800 ms', 'Infinite'], content: ['id_automouse_timeout', 0, 5] },
        ] },
    ] },
    { label: 'Advanced', content: [
        { label: 'Scan Speed', type: 'dropdown', options: ['0', '1', '2', '3', '4', '5', '6'], content: ['id_turbo_scan', 0, 9] },
        { label: 'Scan Pre-wait (us, 0 = auto)', type: 'range', options: [0, 1000], content: ['id_scan_prewait_us', 0, 13] },
        { label: 'Scan Post-wait (us, 0 = auto)', type: 'range', options: [0, 1000], content: ['id_scan_postwait_us', 0, 14] },
    ] },
] }];
const NEW_MENUS: CustomUIMenuItem[] = [{ label: 'Pointing Device', content: [
    { label: 'Auto Mouse', content: [
        { label: 'Enable Auto Mouse', type: 'toggle', content: ['id_automouse_enable', 0, 4] },
        { showIf: '{id_automouse_enable} == 1', content: [
            { label: 'No Layer Timeout', type: 'toggle', content: ['id_automouse_no_timeout', 0, 50] },
            { label: 'Layer Timeout (ms)', type: 'range', options: [100, 2000, 10], content: ['id_automouse_timeout_ms', 0, 49] },
        ] },
    ] },
    { label: 'Advanced', content: [
        { label: 'Scan Pre-wait (us)', type: 'range', options: [1, 1000], content: ['id_scan_prewait_us', 0, 13] },
        { label: 'Scan Post-wait (us)', type: 'range', options: [1, 1000], content: ['id_scan_postwait_us', 0, 14] },
    ] },
] }];
const OLD = boardMenuRefs(OLD_MENUS);
const NEW = boardMenuRefs(NEW_MENUS);

const v = (key: string, data: number[], valueId = 0): CustomValueEntry => ({ key, channel: 0, valueId, data });
const le = (n: number) => [n & 0xff, (n >> 8) & 0xff];
const valueOf = (values: CustomValueEntry[], key: string) => {
    const e = values.find(entry => entry.key === key);
    return e ? e.data.reduce((sum, byte, i) => sum | (byte << (8 * i)), 0) : undefined;
};
const keys = (values: CustomValueEntry[]) => values.map(entry => entry.key).sort();

describe('x4.2 layout on x4.3 firmware', () => {
    it.each(TURBO_US.map((us, index) => [index, us]))('turbo index %i becomes %i / %i µs', (index, us) => {
        const { values, replaced } = migrateCustomValues([v('id_turbo_scan', [index], 9), v('id_scan_prewait_us', [0, 0], 13), v('id_scan_postwait_us', [0, 0], 14)], NEW);
        expect(keys(values)).toEqual(['id_scan_postwait_us', 'id_scan_prewait_us']);
        expect(valueOf(values, 'id_scan_prewait_us')).toBe(us);
        expect(valueOf(values, 'id_scan_postwait_us')).toBe(us);
        expect(values.find(e => e.key === 'id_scan_prewait_us')).toMatchObject({ channel: 0, valueId: 13, data: le(us) });
        expect(replaced).toEqual([{ from: `Scan speed (preset ${index})`, to: `Scan wait before / after read (${us} / ${us} µs)`, release: 'x4.3' }]);
    });
    it('keeps explicit non-zero waits over the preset, and fills only a 0 one', () => {
        const both = migrateCustomValues([v('id_turbo_scan', [6]), v('id_scan_prewait_us', le(40)), v('id_scan_postwait_us', le(10))], NEW).values;
        expect([valueOf(both, 'id_scan_prewait_us'), valueOf(both, 'id_scan_postwait_us')]).toEqual([40, 10]);
        const one = migrateCustomValues([v('id_turbo_scan', [6]), v('id_scan_prewait_us', le(40)), v('id_scan_postwait_us', [0, 0])], NEW).values;
        expect([valueOf(one, 'id_scan_prewait_us'), valueOf(one, 'id_scan_postwait_us')]).toEqual([40, 15]);
        const missing = migrateCustomValues([v('id_turbo_scan', [2])], NEW).values;
        expect([valueOf(missing, 'id_scan_prewait_us'), valueOf(missing, 'id_scan_postwait_us')]).toEqual([45, 45]);
    });
    it('treats an out-of-range preset as preset 0, as the firmware does', () => {
        const { values } = migrateCustomValues([v('id_turbo_scan', [9])], NEW);
        expect([valueOf(values, 'id_scan_prewait_us'), valueOf(values, 'id_scan_postwait_us')]).toEqual([90, 90]);
    });
    it.each(AUTOMOUSE_CHOICES_MS.map((ms, choice) => [choice, ms]))('auto mouse choice %i becomes %i ms with the timeout on', (choice, ms) => {
        const { values, replaced } = migrateCustomValues([v('id_automouse_timeout', [choice], 5)], NEW);
        expect(keys(values)).toEqual(['id_automouse_no_timeout', 'id_automouse_timeout_ms']);
        expect(values.find(e => e.key === 'id_automouse_timeout_ms')).toMatchObject({ valueId: 49, data: le(ms) });
        expect(valueOf(values, 'id_automouse_no_timeout')).toBe(0);
        expect(replaced).toEqual([{ from: `Auto mouse timeout (${ms} ms choice)`, to: `Auto mouse timeout: ${ms} ms`, release: 'x4.3' }]);
    });
    it('turns Infinite into No Layer Timeout and leaves the time alone', () => {
        const { values, replaced } = migrateCustomValues([v('id_automouse_timeout', [5], 5)], NEW);
        expect(keys(values)).toEqual(['id_automouse_no_timeout']);
        expect(values[0]).toMatchObject({ valueId: 50, data: [1] });
        expect(replaced).toEqual([{ from: 'Auto mouse timeout (Infinite choice)', to: 'No layer timeout: on', release: 'x4.3' }]);
    });
    it('passes everything else through untouched', () => {
        const entries = [v('id_automouse_enable', [1], 4), v('id_left_dpi', [4])];
        expect(migrateCustomValues(entries, NEW)).toEqual({ values: entries, replaced: [] });
    });
});

describe('x4.3 layout on x4.2 firmware', () => {
    it('turns the time into the nearest old choice', () => {
        for (const [ms, choice] of [[100, 0], [200, 0], [250, 0], [260, 1], [300, 1], [440, 2], [500, 3], [640, 3], [660, 4], [2000, 4]] as const) {
            expect(nearestAutomouseChoice(ms)).toBe(choice);
            const { values, replaced } = migrateCustomValues([v('id_automouse_timeout_ms', le(ms), 49), v('id_automouse_no_timeout', [0], 50)], OLD);
            expect(keys(values)).toEqual(['id_automouse_timeout']);
            expect(values[0]).toMatchObject({ valueId: 5, data: [choice] });
            expect(replaced).toEqual([{ from: `Auto mouse timeout: ${ms} ms`, to: `Auto mouse timeout (${AUTOMOUSE_CHOICES_MS[choice]} ms choice)`, release: 'x4.3' }]);
        }
    });
    it('turns No Layer Timeout into Infinite', () => {
        const { values } = migrateCustomValues([v('id_automouse_timeout_ms', le(700), 49), v('id_automouse_no_timeout', [1], 50)], OLD);
        expect(values).toEqual([expect.objectContaining({ key: 'id_automouse_timeout', data: [5] })]);
    });
    it('keeps the waits and sets the nearest preset, with no note', () => {
        for (const [pre, post, index] of [[90, 90, 0], [60, 60, 1], [45, 5, 4], [15, 15, 6], [1, 1, 6], [1000, 1000, 0], [40, 40, 2], [52, 52, 2]] as const) {
            expect(nearestTurboIndex(pre, post)).toBe(index);
            const { values, replaced } = migrateCustomValues([v('id_scan_prewait_us', le(pre), 13), v('id_scan_postwait_us', le(post), 14)], OLD);
            expect(valueOf(values, 'id_scan_prewait_us')).toBe(pre);
            expect(valueOf(values, 'id_scan_postwait_us')).toBe(post);
            expect(values.find(e => e.key === 'id_turbo_scan')).toMatchObject({ valueId: 9, data: [index] });
            expect(replaced).toEqual([]);
        }
    });
    it('a tie between two presets goes to the slower one', () => {
        expect(nearestTurboIndex(75, 75)).toBe(0);
        expect(nearestTurboIndex(35, 40)).toBe(2);
    });
    it('on firmware with the preset alone, the waits become the preset', () => {
        const presetOnly = boardMenuRefs([{ label: 'Advanced', content: [{ label: 'Scan Speed', type: 'dropdown', options: ['0', '1', '2', '3', '4', '5', '6'], content: ['id_turbo_scan', 0, 9] }] }]);
        const { values, replaced } = migrateCustomValues([v('id_scan_prewait_us', le(30), 13), v('id_scan_postwait_us', le(30), 14)], presetOnly);
        expect(values).toEqual([expect.objectContaining({ key: 'id_turbo_scan', data: [3] })]);
        expect(replaced).toEqual([{ from: 'Scan wait before / after read (30 / 30 µs)', to: 'Scan speed (preset 3, 30 µs)', release: 'x4.3' }]);
    });
});

describe('import preflight with replaced settings', () => {
    const board = (menus: CustomUIMenuItem[], custom_values: CustomValueEntry[]): KeyboardInfo => ({
        rows: 1, cols: 2, layers: 1, keymap: [[4, 5]], svil_proto: 3, menus, custom_values,
    });
    it('applies an x4.2 layout on x4.3 with no warning, a replacement note and the release', () => {
        const current = board(NEW_MENUS, [v('id_scan_prewait_us', le(90), 13), v('id_scan_postwait_us', le(90), 14), v('id_automouse_timeout_ms', le(500), 49), v('id_automouse_no_timeout', [0], 50)]);
        const file = board(OLD_MENUS, [v('id_turbo_scan', [6], 9), v('id_scan_prewait_us', [0, 0], 13), v('id_scan_postwait_us', [0, 0], 14), v('id_automouse_timeout', [1], 5)]);
        const review = prepareImport(file, current);
        expect(review.errors).toEqual([]);
        expect(review.warnings).toEqual([]);
        expect(review.unavailable).toEqual([]);
        expect(review.replaced.map(r => `${r.from} → ${r.to}`)).toEqual([
            'Scan speed (preset 6) → Scan wait before / after read (15 / 15 µs)',
            'Auto mouse timeout (300 ms choice) → Auto mouse timeout: 300 ms',
        ]);
        expect(firmwareReleaseUrl(review.replaced[0].release)).toBe('https://github.com/svalboard/qmk/releases/tag/x4.3');
        const got = review.keyboard.custom_values ?? [];
        expect([valueOf(got, 'id_scan_prewait_us'), valueOf(got, 'id_scan_postwait_us'), valueOf(got, 'id_automouse_timeout_ms'), valueOf(got, 'id_automouse_no_timeout')]).toEqual([15, 15, 300, 0]);
    });
    it('names a setting with no counterpart by its menu label, with no internal id in the warnings', () => {
        const menus: CustomUIMenuItem[] = [...OLD_MENUS, { label: 'Lights', content: [{ label: 'Sparkle', type: 'toggle', content: ['id_sparkle', 0, 60] }] }];
        const review = prepareImport(board(menus, [v('id_sparkle', [1], 60), v('id_mystery_thing', [1], 61)]), board(NEW_MENUS, []));
        expect(review.unavailable).toEqual(['Lights: Sparkle', 'Mystery thing']);
        expect(review.warnings.join(' ')).not.toMatch(/id_|not supported|skipped/);
    });
    it('names QMK settings by their title', () => {
        const review = prepareImport({ ...board([], []), settings: { 7: 200, 99: 1 } }, { ...board([], []), settings: { 1: 0 } });
        expect(review.unavailable).toEqual(['Tapping Term', 'QMK setting 99']);
    });
});
