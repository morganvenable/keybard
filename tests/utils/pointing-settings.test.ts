import { describe, expect, it } from 'vitest';
import type { CustomUIMenuItem, KeyboardInfo } from '../../src/types/keyboard.types';
import { CustomValueService } from '../../src/services/custom-value.service';
import {
    dpiChoices, effectiveDpiIndex, findMenuItem, formatScrollSpeed, hasPointingCards, maxDpiFor, pointingHands, SCROLL_SPEED_STEPS,
    scrollSpeedIndex, scrollSpeedPercent, SVIL_FLAG4_SCROLL_SPEED, withScrollSpeed,
} from '../../src/utils/pointing-settings';

const DPI = ['200', '400', '600', '800', '1200', '1600', '2400', '3200', '4800', '6400', '12000', '16000'];

const half = (side: 'left' | 'right', detected: string | null, builtFor = 'none') => ({
    usb: side === 'right', side, builtFor, detected, sensorStarted: true, auto: true, productId: 0, inverseProductId: 0,
});
const board = (halves: ReturnType<typeof half>[], extra: Partial<KeyboardInfo> = {}) =>
    ({ pointing_hardware: { halves }, menus: [], ...extra }) as unknown as KeyboardInfo;

describe('Scroll speed detents', () => {
    it('has the proposal\'s 20 log steps from 0.2x to 10x', () => {
        expect(SCROLL_SPEED_STEPS).toHaveLength(20);
        expect(SCROLL_SPEED_STEPS[0]).toBe(0.2);
        expect(SCROLL_SPEED_STEPS[SCROLL_SPEED_STEPS.length - 1]).toBe(10);
        expect(SCROLL_SPEED_STEPS[9]).toBe(1.0);
    });

    it('stores percent: 20 to 1000, 100 for 1.0x', () => {
        expect(scrollSpeedPercent(0)).toBe(20);
        expect(scrollSpeedPercent(9)).toBe(100);
        expect(scrollSpeedPercent(19)).toBe(1000);
        expect(scrollSpeedPercent(1)).toBe(25);
    });

    it('puts every detent back on itself', () => {
        SCROLL_SPEED_STEPS.forEach((_, i) => expect(scrollSpeedIndex(scrollSpeedPercent(i))).toBe(i));
    });

    it('shows an off-detent value on the nearest detent in log distance, and clamps out-of-range ones', () => {
        expect(scrollSpeedIndex(105)).toBe(9);
        expect(scrollSpeedIndex(190)).toBe(SCROLL_SPEED_STEPS.indexOf(2));
        expect(scrollSpeedIndex(5)).toBe(0);
        expect(scrollSpeedIndex(5000)).toBe(19);
        expect(scrollSpeedIndex(0)).toBe(9);
    });

    it('formats as 1.0x, 0.25x, 2.5x and 10x', () => {
        expect(formatScrollSpeed(1)).toBe('1.0×');
        expect(formatScrollSpeed(0.25)).toBe('0.25×');
        expect(formatScrollSpeed(2.5)).toBe('2.5×');
        expect(formatScrollSpeed(2)).toBe('2.0×');
        expect(formatScrollSpeed(10)).toBe('10×');
        expect(formatScrollSpeed(0.2)).toBe('0.2×');
    });
});

describe('Pointer speed lists only what does something', () => {
    it('stops a pad at 1200, a PMW3360 at 12000 and a PMW3389 at 16000', () => {
        expect(maxDpiFor('azoteq', false)).toBe(1200);
        expect(maxDpiFor('pmw3360', false)).toBe(12000);
        expect(maxDpiFor('pmw3389', false)).toBe(16000);
        expect(dpiChoices(DPI, 1200).map((c) => c.dpi)).toEqual([200, 400, 600, 800, 1200]);
        expect(dpiChoices(DPI, 12000).map((c) => c.dpi).pop()).toBe(12000);
        expect(dpiChoices(DPI, 16000).map((c) => c.dpi).pop()).toBe(16000);
    });

    it('keeps the stored index of each choice', () => {
        expect(dpiChoices(DPI, 1200).map((c) => c.index)).toEqual([0, 1, 2, 3, 4]);
    });

    it('gives a TrackPoint no list until the firmware scales it, then the whole list', () => {
        expect(maxDpiFor('trackpoint', false)).toBeUndefined();
        expect(maxDpiFor('trackpoint', true)).toBe(3200);
        expect(dpiChoices(DPI, 3200).map((c) => c.dpi)).toEqual([200, 400, 600, 800, 1200, 1600, 2400, 3200]);
        expect(dpiChoices(DPI, null)).toHaveLength(DPI.length);
    });

    it('does not limit a hand whose module the board does not name', () => {
        expect(maxDpiFor(null, false)).toBeNull();
    });

    it('shows a pad saved above its limit as the limit', () => {
        const choices = dpiChoices(DPI, 1200);
        expect(effectiveDpiIndex(choices, 6)).toBe(4);
        expect(effectiveDpiIndex(choices, 3)).toBe(3);
        expect(effectiveDpiIndex(choices, undefined)).toBeUndefined();
    });
});

describe('The hands a board shows', () => {
    it('names each hand by the module detected on it, left first', () => {
        const hands = pointingHands(board([half('right', 'azoteq'), half('left', 'pmw3389')]));
        expect(hands.map((h) => [h.side, h.moduleName])).toEqual([['left', 'Trackball, PMW3389'], ['right', 'Touchpad, Azoteq']]);
    });

    it('leaves out a half with no module and falls back to the module its firmware drives', () => {
        expect(pointingHands(board([half('left', 'none'), half('right', null, 'trackpoint')])).map((h) => [h.side, h.module])).toEqual([['right', 'trackpoint']]);
    });

    it('shows no Pointing card when no half has a module', () => {
        expect(hasPointingCards(board([half('left', 'none'), half('right', 'none')]))).toBe(false);
        expect(hasPointingCards(board([half('left', 'pmw3360')]))).toBe(true);
        expect(hasPointingCards(null)).toBe(false);
    });

    it('shows both hands, unnamed, on an older board that reports no hardware but has the pointer menu', () => {
        const old = { menus: [{ label: 'Pointing Device', content: [] }] } as unknown as KeyboardInfo;
        expect(hasPointingCards(old)).toBe(true);
        expect(pointingHands(old).map((h) => [h.side, h.module])).toEqual([['left', null], ['right', null]]);
    });
});

describe('Scroll speed in the menu', () => {
    const menus: CustomUIMenuItem[] = [{ label: 'Pointing Device', content: [
        { label: 'Left Pointer', content: [{ label: 'DPI', type: 'dropdown', options: DPI, content: ['id_left_dpi', 0, 0] }] },
        { label: 'Scroll Settings', content: [{ label: 'Natural Scroll', type: 'toggle', content: ['id_natural_scroll', 0, 7] }] },
    ] }];

    it('adds nothing for firmware without the flag', () => {
        expect(withScrollSpeed(menus, 0)).toBe(menus);
        expect(withScrollSpeed(menus, undefined)).toBe(menus);
    });

    it('adds VIA 61 and 62 as two-byte percents before Scroll Settings when the flag is set', () => {
        const out = withScrollSpeed(menus, SVIL_FLAG4_SCROLL_SPEED);
        const left = findMenuItem(out[0].content as CustomUIMenuItem[], 'id_left_scroll_speed')!;
        const right = findMenuItem(out[0].content as CustomUIMenuItem[], 'id_right_scroll_speed')!;
        expect(left.content).toEqual(['id_left_scroll_speed', 0, 61]);
        expect(right.content).toEqual(['id_right_scroll_speed', 0, 62]);
        expect(left.options).toEqual([20, 1000, 1]);
        const labels = (out[0].content as CustomUIMenuItem[]).map((i) => i.label);
        expect(labels).toEqual(['Left Pointer', 'Scroll speed', 'Scroll Settings']);
    });

    it('does not add them twice', () => {
        const once = withScrollSpeed(menus, SVIL_FLAG4_SCROLL_SPEED);
        expect(withScrollSpeed(once, SVIL_FLAG4_SCROLL_SPEED)).toBe(once);
    });
});

describe('Scroll speed log mapping and firmware units', () => {
    // The firmware stores a little-endian u16 percent (protocol.md, values 61 and 62).
    const toWire = (percent: number): number[] => [percent & 0xff, (percent >> 8) & 0xff];
    const fromWire = (b: number[]): number => b[0] | (b[1] << 8);
    const item = { label: 'Left Scroll speed', type: 'range', options: [20, 1000, 1], content: ['id_left_scroll_speed', 0, 61] } as CustomUIMenuItem;
    const service = new CustomValueService({} as never);

    it('steps are evenly spread on a log scale within a factor of 1.5', () => {
        for (let i = 1; i < SCROLL_SPEED_STEPS.length; i++) {
            const ratio = SCROLL_SPEED_STEPS[i] / SCROLL_SPEED_STEPS[i - 1];
            expect(ratio).toBeGreaterThan(1);
            expect(ratio).toBeLessThanOrEqual(1.34);
        }
        expect(Math.log(10 / 0.2) / (SCROLL_SPEED_STEPS.length - 1)).toBeLessThan(0.21);
    });

    it('every detent survives the slider to wire to slider round trip', () => {
        SCROLL_SPEED_STEPS.forEach((step, i) => {
            const percent = scrollSpeedPercent(i);
            expect(percent).toBe(Math.round(step * 100));
            expect(fromWire(toWire(percent))).toBe(percent);
            expect(scrollSpeedIndex(fromWire(toWire(percent)))).toBe(i);
        });
    });

    it('reads a 1000 percent value as two bytes through the board reader', () => {
        expect(service.getByteWidth(item)).toBe(2);
        expect(toWire(1000)).toEqual([0xe8, 0x03]);
        expect(service.bytesToInt([0xe8, 0x03], 2)).toBe(1000);
        expect(service.intToBytes(1000, 2)).toEqual([0xe8, 0x03]);
        expect(service.intToBytes(100, 2)).toEqual([100, 0]);
    });

    it('the readout of a stored percent is its nearest detent', () => {
        expect(formatScrollSpeed(SCROLL_SPEED_STEPS[scrollSpeedIndex(100)])).toBe('1.0×');
        expect(formatScrollSpeed(SCROLL_SPEED_STEPS[scrollSpeedIndex(151)])).toBe('1.5×');
        expect(formatScrollSpeed(SCROLL_SPEED_STEPS[scrollSpeedIndex(1000)])).toBe('10×');
        expect(formatScrollSpeed(SCROLL_SPEED_STEPS[scrollSpeedIndex(20)])).toBe('0.2×');
    });

    it('migrated DPI over 800 values land on the nearest detent', () => {
        // 1210/800 on a pad, 1600/800, 12000/800 clamps to the top of the range
        expect(SCROLL_SPEED_STEPS[scrollSpeedIndex(151)]).toBe(1.5);
        expect(SCROLL_SPEED_STEPS[scrollSpeedIndex(200)]).toBe(2);
        expect(SCROLL_SPEED_STEPS[scrollSpeedIndex(1500)]).toBe(10);
    });
});
