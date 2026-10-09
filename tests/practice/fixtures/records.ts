// Practice test fixtures: keystroke events, steps and result records.
import type { PracticeStep } from '@/features/practice/store/results';
import type { KeystrokeEvent, ResultRecord } from '@/features/practice/types';

/** A hit on `path` ("layer:index:shift"), inferred, with no live sub-timings. */
export function hit(t: number, expected: number, path: string, ttt: number | null, extra: Partial<KeystrokeEvent> = {}): KeystrokeEvent {
    const [layer, index] = path.split(':').map(Number);
    return {
        t, expected, typed: expected, kind: 'hit', raw: ttt ?? 0, ttt, path, prereq: [],
        phys: { index, layer, confidence: 'inferred', skew: null, reach: null, target: null }, ...extra,
    };
}

export function step(timeStamp: number, codePoint: number, path: string, timeToType: number, typo = false): PracticeStep {
    return { timeStamp, codePoint, timeToType, typo, path };
}

/** A valid 15-character Guided result over a, s and d. */
export function record(ts: number, profileId = 'me', h: ResultRecord['h'] = {
    '97|0:26:n': { h: 5, m: 0, t: 200 },
    '115|0:20:n': { h: 5, m: 1, t: 250 },
    '100|0:14:n': { h: 5, m: 0, t: 300 },
}): ResultRecord {
    return {
        schema: 1, profileId, l: 'custom', m: 'generated', ts, n: 15, t: 4000, e: 1, h, k: {}, r: {},
        x: { type: 'guided', scope: { layer: null, group: null, dirs: null, hands: null, thumbs: true }, target: 175, src: 'keymap', obs: 0, inf: 15, board: 'example', os: 'us', km: 'abcd' },
    };
}
