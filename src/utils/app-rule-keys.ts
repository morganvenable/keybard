// The board stores only an app rule's 4-byte ID, never the app key it was made from.
// Keybard remembers each key it hashed, in this browser only, so a rule read back
// from the board shows "notepad.exe" rather than a number. Shared by every board.
// A website rule needs none of this: its label is its site (siteOfRule).
import { appId, canonicalAppKey, isSiteKey, siteKey, siteOfRule, SITE_PREFIX } from "@/services/app-rules";
import type { AppRule } from "@/types/keyboard.types";
import { appStorage } from "@/utils/app-storage";

export const APP_RULE_KEYS_STORAGE = "keybard-app-rule-keys";
/** Enough for every app a person has ever named; the oldest go first past this. */
const MAX_KEYS = 512;

type Stored = Record<string, string>;

function read(): Stored {
    try {
        const v = JSON.parse(appStorage.getItem(APP_RULE_KEYS_STORAGE) || "{}");
        return v && typeof v === "object" && !Array.isArray(v) ? v as Stored : {};
    } catch {
        return {};
    }
}

/** Remember the app keys (as typed, trimmed) under their IDs. Empty keys are skipped. */
export function rememberAppKeys(keys: Iterable<string>): void {
    const stored = read();
    let changed = false;
    for (const raw of keys) {
        const key = isSiteKey(raw) ? siteKey(raw) : canonicalAppKey(raw) ? raw.trim() : "";
        if (!key) continue;
        const id = String(appId(key));
        if (stored[id] === key) continue;
        delete stored[id]; // re-insert: most recent last
        stored[id] = key;
        changed = true;
    }
    if (!changed) return;
    const entries = Object.entries(stored);
    const kept = Object.fromEntries(entries.slice(Math.max(0, entries.length - MAX_KEYS)));
    try {
        appStorage.setItem(APP_RULE_KEYS_STORAGE, JSON.stringify(kept));
    } catch {
        /* storage can be blocked */
    }
}

export const rememberAppKey = (key: string): void => rememberAppKeys([key]);

/** The app key of a rule read from the board: a website rule's from its label, else the one remembered. */
export function ruleKey(rule: Pick<AppRule, "appId" | "label">): string | undefined {
    const site = siteOfRule(rule);
    return site ? SITE_PREFIX + site : appKeyFor(rule.appId);
}

/** The app key remembered for an ID, if any. */
export function appKeyFor(id: number): string | undefined {
    if (!id) return undefined;
    const key = read()[String(id >>> 0)];
    return typeof key === "string" && appId(key) === id >>> 0 ? key : undefined;
}
