import { describe, expect, it } from 'vitest';
import { packEvents, unpackEvents, WORDS_PER_EVENT } from '@/features/practice/store/pack';
import { ERROR_CLASSES, type KeystrokeEvent } from '@/features/practice/types';

function event(overrides: Partial<KeystrokeEvent> & { phys?: Partial<KeystrokeEvent['phys']> } = {}): KeystrokeEvent {
    const { phys, ...rest } = overrides;
    return {
        t: 0, expected: 0x61, typed: 0x61, kind: 'hit', raw: 0, ttt: null, path: '0:26:n', prereq: [],
        ...rest,
        phys: { index: 26, layer: 0, confidence: 'inferred', skew: null, reach: null, target: null, ...phys },
    };
}

describe('event packing, layout 1 (§8.2)', () => {
    it('takes 20 bytes per event', () => {
        expect(packEvents([event(), event()]).byteLength).toBe(2 * WORDS_PER_EVENT * 4);
    });

    it('round-trips every field', () => {
        const events = [
            event({ t: 0 }),
            event({
                t: 412.3, expected: 0x21, typed: 0x21, path: '1:27:f', prereq: [32], delayed: true,
                phys: { index: 27, layer: 1, confidence: 'observed', skew: -37, reach: 120, target: 170 },
            }),
            event({ t: 500, expected: 0x41, typed: 0x71, kind: 'miss', path: '0:26:u', prereq: [2], errorClass: 'wrong-layer',
                phys: { index: 27, layer: 0, confidence: 'observed', skew: 12 } }),
            event({ t: 650.5, expected: 0x41, typed: null, kind: 'backspace', path: '', phys: { index: -1, layer: -1 } }),
            event({ t: 800, expected: 0x41, typed: 0x41, path: '0:26:u', prereq: [2, 32] }),
            event({ t: 900, expected: 0x20, typed: 0x6a, kind: 'stray', path: '0:38:n', phys: { index: 38, layer: 0 } }),
        ];
        const out = unpackEvents(packEvents(events));
        expect(out).toHaveLength(events.length);
        out.forEach((e, i) => {
            const src = events[i];
            expect(e.t).toBeCloseTo(src.t, 1);
            expect(e.expected).toBe(src.expected);
            expect(e.typed).toBe(src.typed);
            expect(e.kind).toBe(src.kind);
            expect(e.prereq).toEqual(src.prereq);
            expect(e.phys).toEqual(src.phys);
            expect(e.errorClass).toBe(src.errorClass);
            expect(!!e.delayed).toBe(!!src.delayed);
            // The path is rebuilt from the physical key: exact for hits, the pressed key for misses.
            const rebuilt = src.phys.index < 0 ? '' : `${src.phys.layer}:${src.phys.index}:${src.path.split(':')[2] ?? 'n'}`;
            expect(e.path).toBe(rebuilt);
            if (src.kind === 'hit') expect(e.path).toBe(src.path);
        });
    });

    it('rebuilds raw and ttt from t, the previous hit, the prerequisite count and the 2 s rule', () => {
        const out = unpackEvents(packEvents([
            event({ t: 0 }),
            event({ t: 400, prereq: [32] }),
            event({ t: 450, kind: 'miss' }),
            event({ t: 700 }),
            event({ t: 3000 }),
        ]));
        expect(out.map((e) => e.raw)).toEqual([0, 400, 50, 300, 2300]);
        expect(out.map((e) => e.ttt)).toEqual([null, 200, null, 300, null]);
    });

    it('packs every error class', () => {
        const out = unpackEvents(packEvents(ERROR_CLASSES.map((errorClass, i) => event({ t: i, kind: 'miss', errorClass }))));
        expect(out.map((e) => e.errorClass)).toEqual([...ERROR_CLASSES]);
    });

    it('clamps and marks boundary values', () => {
        const [e] = unpackEvents(packEvents([event({
            t: 119 * 3600 * 1000, expected: 0x10ffff, typed: 0x10ffff, path: '30:59:u', prereq: [126, 0],
            phys: { index: 59, layer: 30, confidence: 'observed', skew: 5000, reach: 70_000, target: -5 },
        })]));
        expect(e.t).toBe(119 * 3600 * 1000);
        expect(e.expected).toBe(0x10ffff);
        expect(e.typed).toBe(0x10ffff);
        expect(e.prereq).toEqual([126, 0]);
        expect(e.phys).toMatchObject({ index: 59, layer: 30, skew: 1023, reach: 65_534, target: 0 });
        expect(e.path).toBe('30:59:u');
        const [neg] = unpackEvents(packEvents([event({ phys: { skew: -5000 } })]));
        expect(neg.phys.skew).toBe(-1023);
    });

    it('keeps at most two prerequisites', () => {
        const [e] = unpackEvents(packEvents([event({ prereq: [1, 2, 3] })]));
        expect(e.prereq).toEqual([1, 2]);
    });

    it('rejects a buffer that is not whole events', () => {
        expect(() => unpackEvents(new ArrayBuffer(12))).toThrow();
    });
});
