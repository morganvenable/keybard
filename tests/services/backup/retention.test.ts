import { describe, expect, it } from 'vitest';
import { datedFilesToKeep, dayKey, snapshotsToKeep, snapshotsToPrune } from '../../../src/services/backup/retention';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
// Local noon, so day arithmetic never straddles midnight.
const NOW = new Date(2026, 9, 6, 12, 0, 0).getTime();
const snap = (id: string, ageMs: number, kind = 'edited') => ({ id, savedAt: NOW - ageMs, kind });

describe('snapshot retention', () => {
    it('keeps everything from the last 24 hours', () => {
        const snaps = [snap('a', 1000), snap('b', HOUR), snap('c', 10 * HOUR), snap('d', 23 * HOUR)];
        expect(snapshotsToPrune(snaps, NOW)).toEqual([]);
    });

    it('keeps one (the latest) per day between 1 and 30 days old', () => {
        const snaps = [
            snap('d3-late', 3 * DAY - 2 * HOUR), snap('d3-early', 3 * DAY + 3 * HOUR),
            snap('d10-late', 10 * DAY - HOUR), snap('d10-early', 10 * DAY + HOUR),
        ];
        const keep = snapshotsToKeep(snaps, NOW);
        expect([...keep].sort()).toEqual(['d10-late', 'd3-late']);
    });

    it('treats a day partly inside the last 24 hours as already represented', () => {
        // Yesterday 13:00 (23h old) is kept; yesterday 09:00 (27h old) is the same day.
        const keep = snapshotsToKeep([snap('y13', 23 * HOUR), snap('y09', 27 * HOUR)], NOW);
        expect([...keep]).toEqual(['y13']);
    });

    it('keeps one per month beyond 30 days', () => {
        const july5 = new Date(2026, 6, 5, 12).getTime();
        const july20 = new Date(2026, 6, 20, 12).getTime();
        const june1 = new Date(2026, 5, 1, 12).getTime();
        const june2 = new Date(2026, 5, 2, 12).getTime();
        const snaps = [
            { id: 'jul5', savedAt: july5, kind: 'edited' }, { id: 'jul20', savedAt: july20, kind: 'edited' },
            { id: 'jun1', savedAt: june1, kind: 'edited' }, { id: 'jun2', savedAt: june2, kind: 'edited' },
        ];
        expect([...snapshotsToKeep(snaps, NOW)].sort()).toEqual(['jul20', 'jun2']);
    });

    it('never deletes the most recent connected snapshot', () => {
        const snaps = [
            snap('edit-new', 5 * DAY - HOUR),
            snap('conn', 5 * DAY + HOUR, 'connected'), // same day as edit-new, older
            snap('conn-old', 50 * DAY, 'connected'),
            snap('conn-older', 51 * DAY, 'connected'),
        ];
        const keep = snapshotsToKeep(snaps, NOW);
        expect(keep.has('conn')).toBe(true);
        expect(keep.has('edit-new')).toBe(true);
        expect(keep.has('conn-older')).toBe(false);
    });

    it('formats local calendar days', () => {
        expect(dayKey(NOW)).toBe('2026-10-06');
    });
});

describe('folder dated-file retention', () => {
    it('keeps every day for 30 days and the latest day of each older month', () => {
        const days = ['2026-10-05', '2026-09-20', '2026-09-07', '2026-08-30', '2026-08-02', '2026-07-31', '2026-07-01', '2025-12-25'];
        const keep = datedFilesToKeep(days, NOW);
        expect([...keep].sort()).toEqual(['2025-12-25', '2026-07-31', '2026-08-30', '2026-09-07', '2026-09-20', '2026-10-05']);
    });
});
