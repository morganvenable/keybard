// Profiles and board identity (spec §8.1).
//
// Profile scope is OWNER_Q6. With 'user' (recommended) Practice starts with one
// local profile, "Me", and the user picks the active one; no board decides it.
// With 'per-board' the active profile follows the normalized board identity.
// Either way every result records the board it was typed on (`x.board`).
import { OWNER_Q6_PROFILE_SCOPE } from '@/constants/owner-decisions';
import type { ProfileRecord } from '../types';
import type { PracticeStore } from './db';
import { RECORD_SCHEMA } from './migrations';

export const DEFAULT_PROFILE_ID = 'me';
export const DEFAULT_PROFILE_NAME = 'Me';

/**
 * `serial` is the board's persistent serial: pass it only when IdentityInfo's
 * serialSource is not None, as BackupContext's boardKeyFor does.
 */
export type BoardSource =
    | { kind: 'connected'; serial?: string | null; kbid?: string | null }
    | { kind: 'file'; kbid?: string | null; kbidRadix?: 10 | 16 }
    | { kind: 'example' }
    | { kind: 'host'; serial?: string | null; kbid?: string | null };

/** 16-digit upper-case hex of a UID given in hex (connected boards, current file loader) or decimal. */
export function normalizeUid(kbid: string, radix: 10 | 16 = 16): string | null {
    const text = kbid.trim().replace(/^0x/i, '');
    if (!text || (radix === 16 ? !/^[\da-f]+$/i.test(text) : !/^\d+$/.test(text))) return null;
    const value = radix === 16 ? BigInt(`0x${text}`) : BigInt(text);
    return value.toString(16).toUpperCase().padStart(16, '0');
}

/**
 * The normalized `x.board` of a result (§8.1 table). Keybard's file loader
 * already converts a file's decimal `uid` to hex (file.service.ts parseContent),
 * so files default to radix 16; pass 10 for a raw decimal uid.
 */
export function boardIdentity(source: BoardSource): string {
    if (source.kind === 'example') return 'example';
    if ((source.kind === 'connected' || source.kind === 'host') && source.serial) {
        const serial = source.serial.startsWith('sval:') ? source.serial : `sval:${source.serial}`;
        // As boardKeyFor (BackupContext.tsx): an all-zero serial is not persistent, so the UID decides.
        if (!/^sval:0+$/.test(serial)) return serial;
    }
    const uid = source.kbid ? normalizeUid(source.kbid, source.kind === 'file' ? source.kbidRadix ?? 16 : 16) : null;
    return uid ? `uid:${uid}` : 'unknown';
}

export function newProfile(id: string, name: string, now = Date.now()): ProfileRecord {
    return { schema: RECORD_SCHEMA, id, name, createdAt: now, lastUsedAt: now, language: 'en', startDone: false };
}

/** A fresh profile id for "New profile…". */
export function profileIdFor(name: string, taken: Iterable<string>): string {
    const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'profile';
    const used = new Set(taken);
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    return id;
}

/**
 * The profile lessons go to. 'user' scope: the remembered active profile, else
 * "Me" (created on first use). 'per-board' scope: one profile per board identity.
 */
export async function activeProfile(
    store: PracticeStore,
    options: { activeId?: string | null; board?: string | null; scope?: 'user' | 'per-board'; now?: number } = {},
): Promise<ProfileRecord> {
    const scope = options.scope ?? OWNER_Q6_PROFILE_SCOPE;
    const now = options.now ?? Date.now();
    if (scope === 'per-board' && options.board) {
        const id = `board:${options.board}`;
        const existing = await store.getProfile(id);
        if (existing) return existing;
        const created = newProfile(id, options.board === 'example' ? 'Example' : options.board, now);
        await store.putProfile(created);
        return created;
    }
    if (options.activeId) {
        const chosen = await store.getProfile(options.activeId);
        if (chosen) return chosen;
    }
    const me = await store.getProfile(DEFAULT_PROFILE_ID);
    if (me) return me;
    const created = newProfile(DEFAULT_PROFILE_ID, DEFAULT_PROFILE_NAME, now);
    await store.putProfile(created);
    return created;
}
