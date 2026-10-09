// What P5 needs from the stored keystrokes (spec §5.7, §8.2, M4): per character,
// the keys pressed instead of it ("Pressed instead", with their §6.6 class) and
// its layer reach. Results don't carry these, so they come from the packed
// events of the lessons in scope. Each lesson's contribution is computed once
// (EventStatsCache), so a new lesson reads only its own events; lessons whose
// events were pruned (OWNER_Q5) before they were first read add nothing.
import type { StoredResult } from '../store/db';
import type { ErrorClass, KeystrokeEvent } from '../types';

/** One "Pressed instead" entry: what was typed for the character, how often, and the miss class. */
export interface Confusion {
    /** The character typed instead. */
    typed: number;
    /** Layer of the key pressed for it (its cap's face), -1 when unknown. */
    layer: number;
    count: number;
    errorClass: ErrorClass | null;
    /** Every one of these misses was inferred from the keymap (no board reading). */
    inferred: boolean;
}

export interface CharEventStats {
    /** Most frequent first. */
    confusions: Confusion[];
    /** Live layer reach (§6.5): observed hits with a new prerequisite, and their total ms. */
    reachN: number;
    reachTime: number;
}

export type EventStats = ReadonlyMap<number, CharEventStats>;

/** Mean layer reach in ms, or null without live samples. */
export function charReach(stats: CharEventStats | undefined): number | null {
    return stats && stats.reachN > 0 ? stats.reachTime / stats.reachN : null;
}

/** P5's top entries (3), most frequent first, then by character. */
export function topConfusions(stats: CharEventStats | undefined, n = 3): Confusion[] {
    return (stats?.confusions ?? []).slice(0, n);
}

/** One lesson's events added up per expected character. */
export function lessonEventStats(events: readonly KeystrokeEvent[]): EventStats {
    const out = new Map<number, CharEventStats>();
    const get = (char: number) => {
        let s = out.get(char);
        if (!s) out.set(char, (s = { confusions: [], reachN: 0, reachTime: 0 }));
        return s;
    };
    for (const event of events) {
        if (event.kind === 'miss' && event.typed != null && event.typed !== event.expected) {
            const s = get(event.expected);
            const errorClass = event.errorClass ?? null;
            const inferred = event.phys.confidence !== 'observed';
            const c = s.confusions.find((x) => x.typed === event.typed && x.errorClass === errorClass);
            if (c) {
                c.count++;
                c.inferred &&= inferred;
                if (c.layer < 0) c.layer = event.phys.layer;
            } else {
                s.confusions.push({ typed: event.typed, layer: event.phys.layer, count: 1, errorClass, inferred });
            }
        } else if (event.kind === 'hit' && event.phys.confidence === 'observed' && event.phys.reach != null && event.prereq.length) {
            const s = get(event.expected);
            s.reachN++;
            s.reachTime += event.phys.reach;
        }
    }
    return out;
}

/** Adds up lessons' stats; confusions most frequent first. */
export function mergeEventStats(lessons: Iterable<EventStats | null | undefined>): EventStats {
    const out = new Map<number, CharEventStats>();
    for (const lesson of lessons) {
        if (!lesson) continue;
        for (const [char, s] of lesson) {
            let into = out.get(char);
            if (!into) out.set(char, (into = { confusions: [], reachN: 0, reachTime: 0 }));
            into.reachN += s.reachN;
            into.reachTime += s.reachTime;
            for (const c of s.confusions) {
                const same = into.confusions.find((x) => x.typed === c.typed && x.errorClass === c.errorClass);
                if (same) {
                    same.count += c.count;
                    same.inferred &&= c.inferred;
                    if (same.layer < 0) same.layer = c.layer;
                } else {
                    into.confusions.push({ ...c });
                }
            }
        }
    }
    for (const s of out.values()) s.confusions.sort((a, b) => b.count - a.count || a.typed - b.typed);
    return out;
}

/** Each lesson's stats, read once from its stored events. */
export class EventStatsCache {
    readonly #byResult = new Map<number, EventStats | null>();

    constructor(private readonly load: (resultId: number) => Promise<readonly KeystrokeEvent[] | null>) {}

    /** The merged stats of these lessons; reads the events of any not read before. */
    async statsFor(records: readonly Pick<StoredResult, 'id'>[]): Promise<EventStats> {
        for (const record of records) {
            if (record.id < 0 || this.#byResult.has(record.id)) continue;
            let stats: EventStats | null = null;
            try {
                const events = await this.load(record.id);
                stats = events ? lessonEventStats(events) : null;
            } catch {
                // A damaged row adds nothing.
            }
            this.#byResult.set(record.id, stats);
        }
        return mergeEventStats(records.map((r) => this.#byResult.get(r.id)));
    }

    clear() {
        this.#byResult.clear();
    }
}
