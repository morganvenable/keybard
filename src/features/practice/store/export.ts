// Practice export and import (spec §8.4).
//
// Import always targets the active profile: every profile in the file is imported
// into it and `profileId` is rewritten. Merge skips results already present
// (same ts, n and t); Replace clears the profile's results, events and snapshot
// first (the UI confirms before calling it). A file with a newer `version` is
// refused. Every record is validated by resultRecordFromJson.
import type { EventsRecord, ProfileRecord, ResultRecord } from '../types';
import type { PracticeStore } from './db';
import { bytesToBase64, base64ToBytes } from './base64';
import { RECORD_SCHEMA } from './migrations';
import { EVENT_LAYOUT, WORDS_PER_EVENT } from './pack';
import { resultRecordFromJson } from './results';

export const EXPORT_FORMAT = 'keybard-practice';
export const EXPORT_VERSION = 1;

export interface ExportedEvents {
    resultId: number;
    layout: 1;
    /** Base64 of the packed layout-1 words. */
    packed: string;
}

export interface PracticeExport {
    format: typeof EXPORT_FORMAT;
    version: typeof EXPORT_VERSION;
    exportedAt: string;
    /** Keybard commit that wrote the file. */
    keybard: string;
    profiles: ProfileRecord[];
    results: ResultRecord[];
    events?: ExportedEvents[];
    settings: unknown;
}

function currentCommit(): string {
    return typeof __GIT_SHA__ === 'string' ? __GIT_SHA__ : 'unknown';
}

/** Builds the export of one profile (its results, optionally its events) and the global settings. */
export async function exportProfile(
    store: PracticeStore,
    profileId: string,
    options: { includeEvents?: boolean; settings?: unknown; now?: Date; keybard?: string } = {},
): Promise<PracticeExport> {
    const profile = await store.getProfile(profileId);
    const results = await store.listResults(profileId);
    const file: PracticeExport = {
        format: EXPORT_FORMAT,
        version: EXPORT_VERSION,
        exportedAt: (options.now ?? new Date()).toISOString(),
        keybard: options.keybard ?? currentCommit(),
        profiles: profile ? [profile] : [],
        results,
        settings: options.settings ?? null,
    };
    if (options.includeEvents) {
        const events: ExportedEvents[] = [];
        for (const id of await store.listEventIds(profileId)) {
            const row = await store.getEvents(id);
            if (row) events.push({ resultId: id, layout: EVENT_LAYOUT, packed: bytesToBase64(new Uint8Array(row.packed)) });
        }
        file.events = events;
    }
    return file;
}

export type ImportMode = 'merge' | 'replace';

export interface ImportSummary {
    added: number;
    /** Already present (Merge). */
    duplicates: number;
    /** Malformed records, skipped. */
    invalid: number;
    events: number;
}

export class ImportError extends Error {
    constructor(message: string, readonly reason: 'format' | 'newer-version') {
        super(message);
        this.name = 'ImportError';
    }
}

/** Reads an export file's JSON: checks the format and version, nothing else yet. */
export function parseExport(json: unknown): { results: unknown[]; events: unknown[]; settings: unknown } {
    if (!json || typeof json !== 'object' || (json as { format?: unknown }).format !== EXPORT_FORMAT) {
        throw new ImportError('This is not a Keybard Practice file.', 'format');
    }
    const file = json as Record<string, unknown>;
    if (typeof file.version !== 'number' || !Number.isInteger(file.version)) throw new ImportError('This Practice file has no version.', 'format');
    if (file.version > EXPORT_VERSION) throw new ImportError('This Practice file was saved by a newer Keybard.', 'newer-version');
    if (!Array.isArray(file.results)) throw new ImportError('This Practice file has no results.', 'format');
    return { results: file.results, events: Array.isArray(file.events) ? file.events : [], settings: file.settings ?? null };
}

const dedupeKey = (r: Pick<ResultRecord, 'ts' | 'n' | 't'>) => `${r.ts}|${r.n}|${r.t}`;

/** Imports a parsed export file into the active profile. */
export async function importIntoProfile(store: PracticeStore, profileId: string, json: unknown, mode: ImportMode): Promise<ImportSummary> {
    const file = parseExport(json);
    if (mode === 'replace') {
        await store.deleteEvents(await store.listEventIds(profileId));
        await store.deleteResults(profileId);
        await store.deleteSnapshot(profileId);
    }
    const existing = new Set((await store.listResults(profileId)).map(dedupeKey));
    const eventsByOldId = new Map<number, ExportedEvents>();
    for (const raw of file.events) {
        const e = raw as Partial<ExportedEvents>;
        if (Number.isSafeInteger(e?.resultId) && e?.layout === EVENT_LAYOUT && typeof e.packed === 'string') eventsByOldId.set(e.resultId!, e as ExportedEvents);
    }
    const summary: ImportSummary = { added: 0, duplicates: 0, invalid: 0, events: 0 };
    const records = file.results.map((raw) => ({ raw, record: resultRecordFromJson(raw) }));
    records.sort((a, b) => (a.record?.ts ?? 0) - (b.record?.ts ?? 0));
    for (const { record } of records) {
        if (!record) { summary.invalid++; continue; }
        const key = dedupeKey(record);
        if (existing.has(key)) { summary.duplicates++; continue; }
        existing.add(key);
        const oldId = record.id;
        const id = await store.addResult({ ...record, id: undefined, profileId });
        summary.added++;
        const events = oldId != null ? eventsByOldId.get(oldId) : undefined;
        if (events) {
            try {
                const bytes = base64ToBytes(events.packed);
                if (bytes.byteLength % (WORDS_PER_EVENT * 4) !== 0) throw new Error('bad length');
                const row: EventsRecord = { schema: RECORD_SCHEMA, resultId: id, profileId, layout: EVENT_LAYOUT, packed: bytes.slice().buffer };
                await store.putEvents(row);
                summary.events++;
            } catch {
                // Events are optional; a damaged row is skipped, the result is kept.
            }
        }
    }
    if (summary.added) await store.deleteSnapshot(profileId);
    return summary;
}
