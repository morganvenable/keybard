// Per-keystroke events: stored per result, pruned to the newest N lessons per
// profile (spec §8.2; N is OWNER_Q5). Results and aggregates are kept forever.
import { OWNER_Q5_EVENT_RETENTION_LESSONS } from '@/constants/owner-decisions';
import type { KeystrokeEvent } from '../types';
import type { PracticeStore } from './db';
import { RECORD_SCHEMA } from './migrations';
import { EVENT_LAYOUT, packEvents, unpackEvents } from './pack';

export async function saveEvents(store: PracticeStore, profileId: string, resultId: number, events: readonly KeystrokeEvent[]) {
    await store.putEvents({ schema: RECORD_SCHEMA, resultId, profileId, layout: EVENT_LAYOUT, packed: packEvents(events) });
}

export async function loadEvents(store: PracticeStore, resultId: number): Promise<KeystrokeEvent[] | null> {
    const row = await store.getEvents(resultId);
    if (!row) return null;
    if (row.layout !== EVENT_LAYOUT) return null; // Layout 2 (combos) arrives with M3.
    return unpackEvents(row.packed);
}

/** Drops event rows beyond the newest `keep` lessons of a profile; returns the pruned result ids. */
export async function pruneEvents(store: PracticeStore, profileId: string, keep = OWNER_Q5_EVENT_RETENTION_LESSONS): Promise<number[]> {
    const ids = await store.listEventIds(profileId);
    const excess = ids.length - Math.max(0, keep);
    if (excess <= 0) return [];
    // Newest by lesson time, not by id: imported results can be older than their ids.
    const ts = new Map((await store.listResults(profileId)).map((r) => [r.id, r.ts]));
    ids.sort((a, b) => (ts.get(a) ?? 0) - (ts.get(b) ?? 0) || a - b);
    const pruned = ids.slice(0, excess);
    await store.deleteEvents(pruned);
    return pruned;
}
