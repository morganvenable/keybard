import { describe, expect, it } from 'vitest';
import { POINT_ACTIONS, POINT_ACTION_DEFAULTS, actionStepCounts, describeActionDefaults, formatPace, formatTravel } from '@/constants/point-controls';

// The firmware's per-action table (keyboards/svalboard/pointing/point_config.c): travel per step
// at 1.00x in counts at 800 CPI, and the default spacing in ms with no rate limit (0: none).
const FIRMWARE: [string, number, number][] = [
    ['Volume', 64, 0], ['Arrows', 160, 65], ['Tabs', 320, 140], ['Tasks', 320, 140],
    ['Zoom', 192, 100], ['Undo / Redo', 256, 150], ['Undo / Redo (Ctrl+Y)', 256, 150], ['Proportional scroll', 64, 0],
];

describe('per-action pointing tool defaults', () => {
    it('match the firmware table for every action', () => {
        expect(POINT_ACTION_DEFAULTS).toHaveLength(POINT_ACTIONS.length);
        FIRMWARE.forEach(([name, counts, pace], action) => {
            expect(POINT_ACTIONS[action].name).toBe(name);
            expect(actionStepCounts(action, 36)).toBe(counts);
            expect(POINT_ACTION_DEFAULTS[action].pace).toBe(pace);
        });
    });
    it('describe each action in plain words', () => {
        expect(FIRMWARE.map((_, action) => describeActionDefaults(action))).toEqual([
            'Volume: default about 2 mm a step, no default limit.',
            'Arrows: default about 5 mm a step, about 15 a second.',
            'Tabs: default about 10 mm a step, about 7 a second.',
            'Tasks: default about 10 mm a step, about 7 a second.',
            'Zoom: default about 6 mm a step, about 10 a second.',
            'Undo / Redo: default about 8 mm a step, about 7 a second.',
            'Undo / Redo (Ctrl+Y): default about 8 mm a step, about 7 a second.',
            'Proportional scroll: continuous, no steps; the speed sets how fast it scrolls.',
        ]);
    });
    it('scale the step with the tool speed and round travel the way people read it', () => {
        expect(actionStepCounts(1, 45)).toBe(80); // Arrows at 2.00x: half the travel
        expect(actionStepCounts(2, 0)).toBe(5120); // Tabs at the slowest speed
        expect(formatTravel(160)).toBe('about 5 mm');
        expect(formatTravel(80)).toBe('about 2.5 mm');
        expect(formatTravel(5120)).toBe('about 163 mm');
        expect(formatTravel(20)).toBe('about 0.6 mm');
        expect(formatPace(0)).toBeNull();
        expect(formatPace(1)).toBe('about 15 a second');
    });
});
