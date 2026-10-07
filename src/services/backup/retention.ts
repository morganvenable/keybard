// Which backups to keep. Pure functions; times are epoch milliseconds, days and
// months are local calendar days and months.

export const DAY_MS = 24 * 60 * 60 * 1000;
/** Keep every snapshot this recent. */
export const KEEP_ALL_MS = DAY_MS;
/** Then one per day for this many days, then one per month. */
export const DAILY_DAYS = 30;

export interface RetainedSnapshot {
    id: string;
    savedAt: number;
    kind: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(time: number): string {
    const d = new Date(time);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function monthKey(time: number): string {
    return dayKey(time).slice(0, 7);
}

/**
 * Snapshots of one board to keep: everything from the last 24 hours, the latest
 * of each day for 30 days, the latest of each month before that, and always the
 * most recent "connected" snapshot.
 */
export function snapshotsToKeep(snapshots: RetainedSnapshot[], now: number): Set<string> {
    const keep = new Set<string>();
    const newestFirst = [...snapshots].sort((a, b) => b.savedAt - a.savedAt);
    const seenDays = new Set<string>();
    const seenMonths = new Set<string>();
    const dailyCutoff = now - DAILY_DAYS * DAY_MS;
    for (const snap of newestFirst) {
        const age = now - snap.savedAt;
        if (age < KEEP_ALL_MS) {
            keep.add(snap.id);
        } else if (snap.savedAt >= dailyCutoff) {
            const day = dayKey(snap.savedAt);
            if (!seenDays.has(day)) keep.add(snap.id);
        } else {
            const month = monthKey(snap.savedAt);
            if (!seenMonths.has(month)) keep.add(snap.id);
        }
        // A newer snapshot of the same day or month already represents it.
        seenDays.add(dayKey(snap.savedAt));
        seenMonths.add(monthKey(snap.savedAt));
    }
    const lastConnected = newestFirst.find((s) => s.kind === "connected");
    if (lastConnected) keep.add(lastConnected.id);
    return keep;
}

/** Ids of snapshots retention removes. */
export function snapshotsToPrune(snapshots: RetainedSnapshot[], now: number): string[] {
    const keep = snapshotsToKeep(snapshots, now);
    return snapshots.filter((s) => !keep.has(s.id)).map((s) => s.id);
}

/**
 * Dated folder files (YYYY-MM-DD) to keep: every day for 30 days, then the
 * latest day of each month.
 */
export function datedFilesToKeep(days: string[], now: number): Set<string> {
    const cutoff = dayKey(now - DAILY_DAYS * DAY_MS);
    const keep = new Set<string>();
    const seenMonths = new Set<string>();
    for (const day of [...days].sort().reverse()) {
        if (day >= cutoff) keep.add(day);
        else if (!seenMonths.has(day.slice(0, 7))) keep.add(day);
        seenMonths.add(day.slice(0, 7));
    }
    return keep;
}

export function isDailyWindow(day: string, now: number): boolean {
    return day >= dayKey(now - DAILY_DAYS * DAY_MS);
}
