import { describe, expect, it, vi } from 'vitest';
import { charReach, EventStatsCache, lessonEventStats, mergeEventStats, topConfusions } from '@/features/practice/state/eventStats';
import type { KeystrokeEvent } from '@/features/practice/types';
import { hit } from '../fixtures/records';

// P5's Pressed instead and layer reach (spec §5.7), from the stored keystrokes.

const cp = (s: string) => s.codePointAt(0)!;

function miss(expected: string, typed: string, errorClass: KeystrokeEvent['errorClass'], observed = false, layer = 0): KeystrokeEvent {
    return {
        t: 0, expected: cp(expected), typed: cp(typed), kind: 'miss', raw: 0, ttt: null, path: '', prereq: [], errorClass,
        phys: { index: 1, layer, confidence: observed ? 'observed' : 'inferred', skew: null, reach: null, target: null },
    };
}

describe('event stats', () => {
    it('counts what was typed instead, per class, most frequent first', () => {
        const stats = lessonEventStats([
            miss('!', 'q', 'wrong-layer'), miss('!', 'q', 'wrong-layer'), miss('!', '1', 'wrong-direction', true, 1),
            miss('!', 'q', 'wrong-layer', true), miss('!', '@', 'wrong-finger', true, 1),
            // A refused right character (no class) and a skipped one (nothing typed) are not confusions.
            { ...miss('!', '!', undefined) }, { ...miss('!', 'x', undefined), typed: null },
        ]);
        const merged = mergeEventStats([stats, lessonEventStats([miss('!', '1', 'wrong-direction', true, 1)])]);
        const top = topConfusions(merged.get(cp('!')));
        expect(top.map((c) => [String.fromCodePoint(c.typed), c.count, c.errorClass, c.inferred, c.layer])).toEqual([
            ['q', 3, 'wrong-layer', false, 0],
            ['1', 2, 'wrong-direction', false, 1],
            ['@', 1, 'wrong-finger', false, 1],
        ]);
        // Only inferred misses: the entry says so.
        expect(lessonEventStats([miss('a', 's', 'wrong-direction')]).get(cp('a'))!.confusions[0].inferred).toBe(true);
    });

    it('adds up live layer reach from observed hits with a new prerequisite', () => {
        const live = (reach: number) => hit(0, cp('!'), '1:27:f', 200, { prereq: [32], phys: { index: 27, layer: 1, confidence: 'observed', skew: 0, reach, target: 100 } });
        const stats = lessonEventStats([live(180), live(220), hit(0, cp('!'), '1:27:f', 200, { prereq: [32] }), hit(0, cp('a'), '0:26:n', 100)]);
        expect(charReach(stats.get(cp('!')))).toBe(200);
        expect(charReach(stats.get(cp('a')))).toBeNull();
        expect(charReach(undefined)).toBeNull();
    });

    it('reads each lesson once and skips lessons without events', async () => {
        const load = vi.fn(async (id: number) => (id === 2 ? null : [miss('a', 's', 'wrong-direction')]));
        const cache = new EventStatsCache(load);
        expect((await cache.statsFor([{ id: 1 }, { id: 2 }])).get(cp('a'))!.confusions[0].count).toBe(1);
        const again = await cache.statsFor([{ id: 1 }, { id: 2 }, { id: 3 }, { id: -1 }]);
        expect(load.mock.calls.map(([id]) => id)).toEqual([1, 2, 3]);
        expect(again.get(cp('a'))!.confusions[0].count).toBe(2);
        // Merging never changes a lesson's cached numbers.
        expect((await cache.statsFor([{ id: 1 }])).get(cp('a'))!.confusions[0].count).toBe(1);
    });
});
