// A short description of what changed between two .svil snapshots, e.g. "3 keys, 1 macro".

type Svil = Record<string, unknown>;

const SECTIONS: Array<{ field: string; one: string; many: string }> = [
    { field: "macro", one: "macro", many: "macros" },
    { field: "tap_dance", one: "tap dance", many: "tap dances" },
    { field: "combo", one: "combo", many: "combos" },
    { field: "key_override", one: "override", many: "overrides" },
    { field: "alt_repeat_key", one: "alt-repeat", many: "alt-repeats" },
    { field: "leader", one: "leader", many: "leaders" },
];

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function countListDiff(a: unknown, b: unknown): number {
    const x = Array.isArray(a) ? a : [];
    const y = Array.isArray(b) ? b : [];
    let n = 0;
    for (let i = 0; i < Math.max(x.length, y.length); i++) if (!same(x[i], y[i])) n++;
    return n;
}

function countKeyDiff(a: unknown, b: unknown): number {
    const flat = (v: unknown) => (Array.isArray(v) ? v.flat(2) : []) as unknown[];
    const x = flat(a);
    const y = flat(b);
    let n = 0;
    for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) n++;
    return n;
}

function countRecordDiff(a: unknown, b: unknown): number {
    const x = (a && typeof a === "object" ? a : {}) as Record<string, unknown>;
    const y = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
    return [...new Set([...Object.keys(x), ...Object.keys(y)])].filter((k) => !same(x[k], y[k])).length;
}

function customValues(v: unknown): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (Array.isArray(v)) for (const e of v) if (e && typeof e === "object" && "key" in e) out[String((e as { key: unknown }).key)] = (e as { data?: unknown }).data;
    return out;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Summarize the difference from `previous` to `current` (both .svil text). */
export function summarizeSvilChange(previous: string | null, current: string): string {
    if (previous === null) return "";
    let a: Svil, b: Svil;
    try {
        a = JSON.parse(previous);
        b = JSON.parse(current);
    } catch {
        return "";
    }
    const parts: string[] = [];
    const keys = countKeyDiff(a.layout, b.layout);
    if (keys) parts.push(plural(keys, "key", "keys"));
    for (const s of SECTIONS) {
        const n = countListDiff(a[s.field], b[s.field]);
        if (n) parts.push(plural(n, s.one, s.many));
    }
    const settings = countRecordDiff(a.settings, b.settings)
        + countRecordDiff(customValues(a.custom_values), customValues(b.custom_values))
        + (same(a.oneshot, b.oneshot) ? 0 : 1);
    if (settings) parts.push(plural(settings, "setting", "settings"));
    const names = same(a.cosmetic, b.cosmetic) ? 0 : 1;
    if (names) parts.push("names");
    if (!parts.length && !same(a, b)) parts.push("other");
    return parts.join(", ");
}
