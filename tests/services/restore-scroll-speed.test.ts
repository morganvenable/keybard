// Restoring an older backup onto firmware with Scroll speed: a hand the backup has no
// Scroll speed for gets DPI / 800 as a percent (the firmware migration's rule).
import { describe, expect, it } from 'vitest';
import { prepareImport } from '../../src/services/import-preflight';
import { fileService } from '../../src/services/file.service';
import { SVIL_FLAG4_SCROLL_SPEED, scrollSpeedFromDpi } from '../../src/utils/pointing-settings';
import type { KeyboardInfo } from '../../src/types/keyboard.types';
import type { PointingModule } from '../../src/utils/pointing-hardware';
import { createKbinfoWithFragments } from '../fixtures/fragments.fixture';

export const DPI_OPTIONS = [200, 400, 800, 1200, 1600];
const dpiMenu = (key: string, valueId: number) => ({ label: key, type: 'dropdown', options: DPI_OPTIONS, content: [key, 0, valueId] });
const speedMenu = (key: string, valueId: number) => ({ label: key, type: 'range', options: [20, 1000, 1], content: [key, 0, valueId] });
const menus = (withSpeed: boolean) => [{
    label: 'Pointing Device',
    content: [dpiMenu('id_left_dpi', 1), dpiMenu('id_right_dpi', 2), ...(withSpeed ? [speedMenu('id_left_scroll_speed', 61), speedMenu('id_right_scroll_speed', 62)] : [])],
}] as any;

const half = (side: 'left' | 'right', module: PointingModule) => ({ usb: side === 'left', side, builtFor: module, detected: module, sensorStarted: true, auto: false }) as any;

function board(module: PointingModule, dpiIndex: number, firmwareHasSpeed: boolean): KeyboardInfo {
    const kb = createKbinfoWithFragments({ layers: 4 });
    kb.kbid = 'a1b2c3d4e5f60718';
    kb.menus = menus(firmwareHasSpeed);
    kb.feature_flags4 = firmwareHasSpeed ? SVIL_FLAG4_SCROLL_SPEED : 0;
    kb.pointing_hardware = { halves: [half('left', module), half('right', module)] } as any;
    kb.custom_values = [
        { key: 'id_left_dpi', channel: 0, valueId: 1, data: [dpiIndex] },
        { key: 'id_right_dpi', channel: 0, valueId: 2, data: [dpiIndex] },
        ...(firmwareHasSpeed ? [
            { key: 'id_left_scroll_speed', channel: 0, valueId: 61, data: [100, 0] },
            { key: 'id_right_scroll_speed', channel: 0, valueId: 62, data: [100, 0] },
        ] : []),
    ];
    return kb;
}

/** A backup file as the older firmware wrote it: DPI index, no Scroll speed. */
function backup(dpiIndex: number, speedPercent?: number): KeyboardInfo {
    const kb = board('pmw3389', dpiIndex, false);
    kb.menus = menus(speedPercent !== undefined);
    if (speedPercent !== undefined) {
        kb.custom_values!.push(
            { key: 'id_left_scroll_speed', channel: 0, valueId: 61, data: [speedPercent & 0xff, speedPercent >> 8] },
            { key: 'id_right_scroll_speed', channel: 0, valueId: 62, data: [speedPercent & 0xff, speedPercent >> 8] });
    }
    return fileService.svilToKBINFO(JSON.parse(fileService.kbinfoToSvil(kb)));
}

const speeds = (kb: KeyboardInfo) => ['id_left_scroll_speed', 'id_right_scroll_speed'].map((key) => {
    const d = kb.custom_values?.find((e) => e.key === key)?.data;
    return d ? d[0] | (d[1] << 8) : undefined;
});

const MODULES: Array<[PointingModule, number[]]> = [
    // 400, 800, 1200, 1600 DPI
    ['pmw3389', [50, 100, 150, 200]],
    ['pmw3360', [50, 100, 150, 200]],
    ['trackpoint', [100, 100, 100, 100]],
    ['azoteq', [50, 100, 150, 151]], // 1200 stays 150; 1600 is counted as 1210: 151
];
const DPIS = [400, 800, 1200, 1600];

describe('Scroll speed from the restored DPI (backup without Scroll speed)', () => {
    for (const [module, expected] of MODULES) {
        DPIS.forEach((dpi, i) => {
            it(`${module} at ${dpi} DPI gets ${expected[i]}%`, () => {
                const review = prepareImport(backup(DPI_OPTIONS.indexOf(dpi)), board(module, 0, true));
                expect(review.errors).toEqual([]);
                expect(speeds(review.keyboard)).toEqual([expected[i], expected[i]]);
                const left = review.keyboard.custom_values!.find((e) => e.key === 'id_left_scroll_speed')!;
                expect(left.valueId).toBe(61);
                expect(review.keyboard.custom_values!.find((e) => e.key === 'id_right_scroll_speed')!.valueId).toBe(62);
            });
        });
    }

    it('a backup with Scroll speed is restored as is, whatever the DPI', () => {
        for (const module of ['pmw3389', 'azoteq', 'trackpoint'] as PointingModule[]) {
            for (const dpi of DPIS) {
                const review = prepareImport(backup(DPI_OPTIONS.indexOf(dpi), 250), board(module, 0, true));
                expect(speeds(review.keyboard)).toEqual([250, 250]);
            }
        }
    });

    it('never writes 61 or 62 to firmware without Scroll speed', () => {
        for (const module of ['pmw3389', 'azoteq', 'trackpoint'] as PointingModule[]) {
            for (const withSpeed of [undefined, 250]) {
                const review = prepareImport(backup(3, withSpeed), board(module, 0, false));
                expect(speeds(review.keyboard)).toEqual([undefined, undefined]);
                expect(review.keyboard.custom_values!.some((e) => e.valueId === 61 || e.valueId === 62)).toBe(false);
            }
        }
    });

    it('uses the firmware migration rule: round to nearest, clamp 20 to 1000, pad cap 1210', () => {
        expect(scrollSpeedFromDpi(1200, 'pmw3389')).toBe(150);
        expect(scrollSpeedFromDpi(100, 'pmw3389')).toBe(20); // 12.5 held to 20
        expect(scrollSpeedFromDpi(12000, 'pmw3389')).toBe(1000); // 1500 held to 1000
        expect(scrollSpeedFromDpi(1210, 'azoteq')).toBe(151); // 151.25
        expect(scrollSpeedFromDpi(4000, 'azoteq')).toBe(151);
        expect(scrollSpeedFromDpi(3200, 'trackpoint')).toBe(100);
        expect(scrollSpeedFromDpi(404, 'pmw3389')).toBe(51); // 50.5 rounds up
    });
});

describe('a backup taken from firmware with Scroll speed', () => {
    it('holds both values', () => {
        const svil = JSON.parse(fileService.kbinfoToSvil(board('pmw3389', 3, true)));
        expect(svil.custom_values.filter((e: any) => e.key.endsWith('_scroll_speed')).map((e: any) => e.valueId)).toEqual([61, 62]);
    });
});
