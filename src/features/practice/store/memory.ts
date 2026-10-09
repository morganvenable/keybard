// In-memory twin of the IndexedDB store (the MemoryBackupStore pattern): tests,
// and the fallback when IndexedDB is unavailable. Values are cloned in and out so
// callers can't mutate stored records, as with IndexedDB's structured clone.
import type { EventsRecord, ProfileRecord, ResultRecord, SnapshotRecord } from '../types';
import type { ImportRow, PracticeStore, StoredResult } from './db';
import { RECORD_SCHEMA } from './migrations';
import { EVENT_LAYOUT } from './pack';

const clone = <T>(value: T): T => structuredClone(value);

export class MemoryPracticeStore implements PracticeStore {
    profiles = new Map<string, ProfileRecord>();
    results = new Map<number, StoredResult>();
    events = new Map<number, EventsRecord>();
    snapshots = new Map<string, SnapshotRecord>();
    private nextId = 1;

    async listProfiles() { return [...this.profiles.values()].map(clone); }
    async getProfile(id: string) { const p = this.profiles.get(id); return p && clone(p); }
    async putProfile(profile: ProfileRecord) { this.profiles.set(profile.id, clone(profile)); }

    async addResult(result: ResultRecord) {
        const id = this.nextId++;
        this.results.set(id, { ...clone(result), id });
        return id;
    }

    async listResults(profileId: string) {
        return [...this.results.values()]
            .filter((r) => r.profileId === profileId)
            .sort((a, b) => a.ts - b.ts || a.id - b.id)
            .map(clone);
    }

    async countResults(profileId: string) {
        let n = 0;
        for (const r of this.results.values()) if (r.profileId === profileId) n++;
        return n;
    }

    async deleteResults(profileId: string) {
        for (const [id, r] of this.results) if (r.profileId === profileId) this.results.delete(id);
    }

    async putEvents(row: EventsRecord) { this.events.set(row.resultId, clone(row)); }
    async getEvents(resultId: number) { const e = this.events.get(resultId); return e && clone(e); }

    async listEventIds(profileId: string) {
        return [...this.events.values()].filter((e) => e.profileId === profileId).map((e) => e.resultId).sort((a, b) => a - b);
    }

    async deleteEvents(resultIds: readonly number[]) { for (const id of resultIds) this.events.delete(id); }

    async importResults(profileId: string, rows: readonly ImportRow[], replace: boolean) {
        // Clone everything first: a row that can't be stored throws before anything changes.
        const values = rows.map((row) => {
            const { id: _ignored, ...result } = row.result;
            return { result: clone({ ...result, profileId }), events: row.events && clone(row.events) };
        });
        if (replace) {
            for (const id of await this.listEventIds(profileId)) this.events.delete(id);
            await this.deleteResults(profileId);
        }
        const ids = values.map(({ result, events }) => {
            const id = this.nextId++;
            this.results.set(id, { ...result, id });
            if (events) this.events.set(id, { schema: RECORD_SCHEMA, resultId: id, profileId, layout: EVENT_LAYOUT, packed: events });
            return id;
        });
        if (replace || rows.length) this.snapshots.delete(profileId);
        return ids;
    }

    async getSnapshot(profileId: string) { const s = this.snapshots.get(profileId); return s && clone(s); }
    async putSnapshot(snapshot: SnapshotRecord) { this.snapshots.set(snapshot.profileId, clone(snapshot)); }
    async deleteSnapshot(profileId: string) { this.snapshots.delete(profileId); }
}
