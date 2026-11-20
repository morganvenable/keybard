import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, RefreshCw, Trash2 } from "lucide-react";

import { LayerPill } from "@/components/LayerPill";
import OnOffToggle from "@/components/ui/OnOffToggle";
import { useChanges } from "@/contexts/ChangesContext";
import { useKeyboard } from "@/contexts/KeyboardContext";
import { fetchHostApps, type HostApps, type HostPlatform } from "@/features/trainer/host-apps";
import { isMacOS } from "@/lib/platform";
import { pickableLayers } from "@/utils/automouse-layers";
import { cn } from "@/lib/utils";
import {
    APP_MASK_LAYERS, APP_RULE_SITE, APP_RULE_TEXT_MAX, APP_RULES_MAX, APP_RULES_RECORD_BYTES, appId, appIdHex, cycleMask,
    hasAppRules, isSiteKey, maskState, normalizeSite, readAppForeground, readAppRules, recordUsed, ruleOn,
    siteMatches, siteProblem, utf8Length, withApp, withRuleOn, withSite, writeAppRules,
} from "@/services/app-rules";
import { svalService } from "@/services/sval.service";
import { usbInstance } from "@/services/usb.service";
import type { AppRule, KeyboardInfo } from "@/types/keyboard.types";
import { rememberAppKeys } from "@/utils/app-rule-keys";
import { ToggleRow } from "./pointing/PointingControls";

/** How long a burst of edits waits before the rules are written once (BEGIN, WRITE, COMMIT). */
export const APP_RULES_WRITE_DELAY_MS = 500;

/** Sample names only: never a real app or site, so a placeholder can't pass for a rule. */
const PLATFORM_HINTS: Record<HostPlatform, { name: string; what: string; example: string }> = {
    windows: { name: "Windows", what: "the program's file name", example: "program.exe" },
    macos: { name: "macOS", what: "the bundle ID", example: "com.example.app" },
    linux: { name: "Linux", what: "the app ID or WM_CLASS", example: "program" },
};
const SITE_EXAMPLE = "example.com";

/** One short line each. */
const SITE_EMPTY = "Matches the site and addresses under it.";
const SITE_ELSEWHERE = "Websites work on Windows for now.";
const SITE_RETYPE = "Retype this site to edit it.";
const TOO_LONG = `Names can be at most ${APP_RULE_TEXT_MAX} bytes.`;
const NO_ROOM = "Not enough room left on the board.";
const BROWSERS = "In Chrome, Edge, Brave, Vivaldi and Firefox; other tabs count as the browser.";

function guessPlatform(): HostPlatform {
    if (isMacOS()) return "macos";
    const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
    return /linux|x11|cros/i.test(ua) && !/android/i.test(ua) ? "linux" : "windows";
}

const layerName = (keyboard: KeyboardInfo, layer: number) => svalService.getLayerNameNoLabel(keyboard, layer);

/** A new rule: empty, and on. */
export const blankRule = (): AppRule => ({ appId: 0, defaultLayer: null, frontLayer: null, onMask: 0, offMask: 0, flags: 0, text: "", key: "" });

const PILL_TEXT = {
    neutral: { aria: "unchanged", title: "left as you set it. Click to turn it on while the app is in front" },
    on: { aria: "turned on", title: "turned on while the app is in front. Click to turn it off instead" },
    off: { aria: "turned off", title: "turned off while the app is in front. Click to leave it as you set it" },
} as const;

const fieldClass = "h-8 min-w-0 rounded-md border border-input bg-kb-surface px-2 text-sm text-kb-ink placeholder:text-muted-foreground placeholder:font-normal";
const iconButton = "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-kb-gray-border/40 hover:text-kb-ink disabled:pointer-events-none disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-kb-ink";

function LayerSelect({ keyboard, label, value, onChange, testId }: {
    keyboard: KeyboardInfo; label: string; value: number | null; onChange: (layer: number | null) => void; testId: string;
}) {
    const count = keyboard.layers || APP_MASK_LAYERS;
    return (
        <label className="flex min-w-[8.5rem] flex-1 flex-col gap-0.5 text-xs text-muted-foreground">
            <span className="whitespace-nowrap">{label}</span>
            <select
                aria-label={label}
                data-testid={testId}
                className={cn(fieldClass, "cursor-pointer font-medium")}
                value={value === null ? "" : String(value)}
                onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
            >
                <option value="">None</option>
                {Array.from({ length: count }, (_, i) => (
                    <option key={i} value={i}>{layerName(keyboard, i)}</option>
                ))}
            </select>
        </label>
    );
}

function RuleCard({ keyboard, rule, index, count, active, hostApps, platform, compact, notice, onChange, onMove, onDelete }: {
    keyboard: KeyboardInfo; rule: AppRule; index: number; count: number; active: boolean;
    hostApps: HostApps | null; platform: HostPlatform; compact: boolean; notice: string | null;
    onChange: (rule: AppRule) => void; onMove: (delta: number) => void; onDelete: () => void;
}) {
    const hint = PLATFORM_HINTS[platform];
    const key = rule.key ?? "";
    // A website rule: its key is `site:` and the site as typed; the board stores the site as its text.
    const website = isSiteKey(key) || (!key && (rule.flags & APP_RULE_SITE) !== 0);
    const typedSite = isSiteKey(key) ? key.replace(/^[ \t]*site:/i, "") : "";
    const problem = website ? siteProblem(typedSite) : null;
    const matches = website ? siteMatches(typedSite) : null;
    // Read from the board, but its text doesn't give its ID (cut short, or never named).
    const unknown = !key && rule.appId !== 0;
    const on = ruleOn(rule);
    const setKind = (kind: string) => {
        if ((kind === "site") === website) return;
        onChange(kind === "site" ? withSite(rule, "") : withApp(rule, ""));
    };
    const layers = Math.min(keyboard.layers || APP_MASK_LAYERS, APP_MASK_LAYERS);
    const n = index + 1;
    const indent = compact ? "pl-0" : "pl-7";
    const line = notice ?? (website
        ? problem ?? (unknown ? SITE_RETYPE : platform !== "windows" ? SITE_ELSEWHERE : !rule.appId || !matches ? SITE_EMPTY : matches)
        : null);
    return (
        <li
            className={cn("flex flex-col gap-2 rounded-lg border border-kb-gray-border bg-kb-surface p-3", compact && "w-[360px] shrink-0 gap-1.5 p-2")}
            data-app-rule={index}
            data-rule-on={on}
            aria-label={`Rule ${n}`}
        >
            {/* What the rule is for: its number, a program or a website, and whether it's on. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="w-5 shrink-0 text-center text-xs font-semibold text-muted-foreground" title="Rules are checked in order; the first that matches applies">{n}</span>
                <select
                    aria-label={`Rule ${n}: a program or a website`}
                    data-testid="app-rule-kind"
                    title="A program, or a website in the browser"
                    className={cn(fieldClass, "w-auto shrink-0 cursor-pointer pr-7 font-medium")}
                    value={website ? "site" : "program"}
                    onChange={(e) => setKind(e.target.value)}
                >
                    <option value="program">Program</option>
                    <option value="site">Website</option>
                </select>
                {active && (
                    <span className="shrink-0 whitespace-nowrap rounded-full bg-kb-active px-2 py-0.5 text-[10px] font-semibold text-kb-active-fg" data-testid="app-rule-active" title="The app in front now matches this rule">
                        Applies now
                    </span>
                )}
                <div className="ml-auto flex shrink-0 items-center gap-1">
                    <OnOffToggle
                        label={`Rule ${n}`}
                        size="sm"
                        value={on}
                        onToggle={(v) => onChange(withRuleOn(rule, v))}
                        className="mr-1"
                    />
                    <button type="button" className={iconButton} aria-label={`Move rule ${n} up`} title="Move up (checked earlier)" disabled={index === 0} onClick={() => onMove(-1)}>
                        <ArrowUp className="h-4 w-4" aria-hidden />
                    </button>
                    <button type="button" className={iconButton} aria-label={`Move rule ${n} down`} title="Move down (checked later)" disabled={index === count - 1} onClick={() => onMove(1)}>
                        <ArrowDown className="h-4 w-4" aria-hidden />
                    </button>
                    <button type="button" className={iconButton} aria-label={`Delete rule ${n}`} title="Delete this rule" onClick={onDelete}>
                        <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                </div>
            </div>
            <div className={cn("flex flex-col gap-2", !on && "opacity-60")}>
                <div className={cn("flex min-w-0 items-center gap-2", indent)}>
                    {website ? (
                        <input
                            type="text"
                            aria-label={`Rule ${n} website`}
                            aria-invalid={problem ? true : undefined}
                            aria-describedby={line ? `app-rule-${index}-hint` : undefined}
                            data-testid="app-rule-site"
                            spellCheck={false}
                            autoComplete="off"
                            className={cn(fieldClass, "w-full flex-1 font-mono", problem && "border-kb-warn-ink")}
                            value={typedSite}
                            placeholder={unknown && rule.text ? rule.text : SITE_EXAMPLE}
                            title={matches ? `${matches}. ${BROWSERS}` : SITE_EMPTY}
                            onChange={(e) => onChange(withSite(rule, e.target.value))}
                        />
                    ) : (
                        <input
                            type="text"
                            aria-label={`Rule ${n} app`}
                            aria-describedby={line ? `app-rule-${index}-hint` : undefined}
                            data-testid="app-rule-key"
                            spellCheck={false}
                            autoComplete="off"
                            className={cn(fieldClass, "w-full flex-1 font-mono")}
                            value={key}
                            placeholder={unknown ? `${rule.text || "Unknown app"} (ID ${appIdHex(rule.appId)})` : hint.example}
                            title={`${hint.name}: ${hint.what}`}
                            onChange={(e) => onChange(withApp(rule, e.target.value))}
                        />
                    )}
                    {!website && hostApps && hostApps.apps.length > 0 && (
                        <select
                            aria-label={`Rule ${n}: pick a running app`}
                            data-testid="app-rule-pick"
                            title="Pick an app running on this computer"
                            className={cn(fieldClass, "w-auto shrink-0 cursor-pointer pr-7")}
                            value=""
                            onChange={(e) => { if (e.target.value) onChange(withApp(rule, e.target.value)); }}
                        >
                            <option value="">Running…</option>
                            {hostApps.apps.map((a) => (
                                <option key={a.key} value={a.key}>{a.name === a.key ? a.key : `${a.name} (${a.key})`}</option>
                            ))}
                        </select>
                    )}
                </div>
                {line && (
                    <p
                        id={`app-rule-${index}-hint`}
                        data-testid={notice ? "app-rule-notice" : "app-rule-site-hint"}
                        role={notice || problem ? "alert" : undefined}
                        className={cn("text-xs leading-snug", indent, notice || problem ? "text-kb-warn-ink" : "text-muted-foreground")}
                    >
                        {line}
                    </p>
                )}
                <div className={cn("flex flex-wrap items-end gap-2", indent)}>
                    <LayerSelect keyboard={keyboard} label="Default layer" testId="app-rule-default" value={rule.defaultLayer}
                        onChange={(defaultLayer) => onChange({ ...rule, defaultLayer })} />
                    <LayerSelect keyboard={keyboard} label="Turn on layer" testId="app-rule-front" value={rule.frontLayer}
                        onChange={(frontLayer) => onChange({ ...rule, frontLayer })} />
                </div>
                <div className={cn("flex flex-col gap-1", indent)}>
                    <span className="text-xs text-muted-foreground">Other layers while the app is in front</span>
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Rule ${n} layers`} data-app-rule-pills>
                        {/* The mouse layer (the last) is Auto Mouse's: the board ignores mask bits for it. */}
                        {pickableLayers(layers).map((i) => {
                            const state = maskState(rule, i);
                            const name = layerName(keyboard, i);
                            return (
                                <LayerPill
                                    key={i}
                                    name={name}
                                    state={state}
                                    data-layer={i}
                                    aria-label={`Layer ${i} ${name}: ${PILL_TEXT[state].aria}`}
                                    title={`${name}: ${PILL_TEXT[state].title}`}
                                    onClick={() => onChange(cycleMask(rule, i))}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>
        </li>
    );
}

/**
 * App Layers (app rules on the board), in its own panel: layer changes while an app is in
 * front on the computer. Shown only on firmware with the feature (GET_INFO byte 22 bit 0).
 * Edits show at once; a burst of them is written once, through the change queue, so Live
 * Updating and Manual Updates work as they do for every other edit.
 */
export default function AppRulesSection({ compact = false, inPanel = false }: { compact?: boolean; /** The App Layers panel, which has the title. */ inPanel?: boolean }) {
    const { keyboard } = useKeyboard();
    // Nothing runs on firmware without the feature: no hooks, no USB requests.
    if (!keyboard || !hasAppRules(keyboard.feature_flags5)) return null;
    return <AppRulesEditor compact={compact} inPanel={inPanel} />;
}

function AppRulesEditor({ compact, inPanel }: { compact: boolean; inPanel: boolean }) {
    const { keyboard, setKeyboard, isConnected } = useKeyboard();
    const { queue } = useChanges();
    const [hostApps, setHostApps] = useState<HostApps | null>(null);
    const [activeRule, setActiveRule] = useState<number | null>(null);
    const [notice, setNotice] = useState<{ index: number; text: string } | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latest = useRef<{ rules: AppRule[]; enabled: boolean } | null>(null);
    const queueRef = useRef(queue);
    queueRef.current = queue;
    const setKeyboardRef = useRef(setKeyboard);
    setKeyboardRef.current = setKeyboard;

    const supported = !!keyboard && hasAppRules(keyboard.feature_flags5);
    const rules = keyboard?.app_rules;
    const enabled = keyboard?.app_layers_enabled !== false;

    const refreshStatus = useCallback(async () => {
        try {
            setActiveRule((await readAppForeground(usbInstance)).rule);
        } catch {
            setActiveRule(null);
        }
    }, []);

    const flush = useCallback(() => {
        if (timer.current) { clearTimeout(timer.current); timer.current = null; }
        const next = latest.current;
        latest.current = null;
        if (!next) return;
        void queueRef.current("App rules", async () => {
            await writeAppRules(usbInstance, next.rules, next.enabled);
            // The switch shows what the board holds, unless another edit is on its way.
            try {
                const back = await readAppRules(usbInstance);
                if (!latest.current) setKeyboardRef.current((cur) => (cur ? { ...cur, app_layers_enabled: back.enabled } : cur));
            } catch { /* the write went through; the next read shows it */ }
            void refreshStatus();
        }, { type: "setting", writeKey: "app-rules" }).catch(() => { /* shown by the change queue */ });
    }, [refreshStatus]);

    // Leaving the panel never loses the last edit.
    useEffect(() => () => { if (timer.current) flush(); }, [flush]);

    useEffect(() => {
        if (!supported || !isConnected) return;
        void refreshStatus();
        let alive = true;
        void fetchHostApps().then((apps) => { if (alive) setHostApps(apps); });
        return () => { alive = false; };
    }, [supported, isConnected, refreshStatus]);

    // Rules the board holds by ID only: name them from the running apps.
    useEffect(() => {
        if (!hostApps || !rules?.some((r) => !r.key && r.appId)) return;
        const byId = new Map(hostApps.apps.map((a) => [appId(a.key), a.key]));
        if (hostApps.foreground) byId.set(appId(hostApps.foreground.key), hostApps.foreground.key);
        const found = rules.filter((r) => !r.key && byId.has(r.appId)).map((r) => byId.get(r.appId)!);
        if (!found.length) return;
        rememberAppKeys(found);
        setKeyboard((cur) => cur?.app_rules ? { ...cur, app_rules: cur.app_rules.map((r) => (!r.key && byId.has(r.appId) ? withApp(r, byId.get(r.appId)!) : r)) } : cur);
    }, [hostApps, rules, setKeyboard]);

    if (!keyboard || !supported) return null;

    const platform = hostApps?.platform ?? guessPlatform();
    const list = rules ?? [];
    // Firmware with the first record format: its rules show, but only newer firmware takes edits.
    const readOnly = keyboard.app_rules_format === 1;
    const used = recordUsed(list);

    const write = (next: AppRule[], nextEnabled: boolean) => {
        rememberAppKeys(next.map((r) => r.key ?? ""));
        setKeyboard((cur) => (cur ? { ...cur, app_rules: next, app_layers_enabled: nextEnabled } : cur));
        if (!isConnected) return;
        latest.current = { rules: next, enabled: nextEnabled };
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(flush, APP_RULES_WRITE_DELAY_MS);
    };
    /** An edit to the rules: refused, with a line under the rule, when it doesn't fit the board. */
    const update = (next: AppRule[], at = -1): boolean => {
        const r = at >= 0 ? next[at] : undefined;
        const typed = r ? (isSiteKey(r.key) ? normalizeSite(r.key ?? "") : (r.key ?? "").trim()) : "";
        if (r && utf8Length(typed) > APP_RULE_TEXT_MAX) { setNotice({ index: at, text: TOO_LONG }); return false; }
        if (recordUsed(next) > APP_RULES_RECORD_BYTES && recordUsed(next) > used) {
            setNotice({ index: at >= 0 ? at : next.length - 1, text: NO_ROOM });
            return false;
        }
        setNotice(null);
        write(next, enabled);
        return true;
    };

    const full = list.length >= APP_RULES_MAX;
    const move = (i: number, delta: number) => {
        const j = i + delta;
        if (j < 0 || j >= list.length) return;
        const next = [...list];
        [next[i], next[j]] = [next[j], next[i]];
        update(next);
    };

    return (
        <section className="flex flex-col gap-3" data-app-rules data-app-layers-on={enabled} aria-labelledby="app-rules-title">
            <h3 id="app-rules-title" className={cn("font-semibold text-kb-ink", compact ? "text-base" : "text-lg", inPanel && "sr-only")}>App Layers</h3>
            <div data-testid="app-layers-switch">
                <ToggleRow
                    label="App Layers"
                    hint="Change layers while an app is in front."
                    value={rules ? (enabled ? 1 : 0) : undefined}
                    onChange={(v) => { if (rules) write(list, v === 1); }}
                    disabled={readOnly}
                />
            </div>
            {readOnly && <p role="note" className="text-sm text-kb-warn-ink" data-testid="app-rules-old-firmware">Update the firmware to edit App Layers.</p>}
            {!rules ? (
                <p role="alert" className="text-sm text-kb-warn-ink">Keybard couldn't read the app rules from the board. Reconnect to try again.</p>
            ) : (
                <>
                    <p className="text-xs text-muted-foreground" data-testid="app-rules-usage">
                        <span data-testid="app-rules-count">{list.length} of {APP_RULES_MAX} rules</span>
                        {" · "}
                        <span data-testid="app-rules-bytes">{used} of {APP_RULES_RECORD_BYTES} bytes used</span>
                    </p>
                    <fieldset disabled={readOnly} className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
                    {list.length > 0 && (
                        <ol className={cn("flex gap-2", compact ? "flex-row overflow-x-auto pb-1" : "flex-col", !enabled && "opacity-60")}>
                            {list.map((rule, i) => (
                                <RuleCard
                                    key={i}
                                    keyboard={keyboard}
                                    rule={rule}
                                    index={i}
                                    count={list.length}
                                    active={enabled && activeRule === i}
                                    hostApps={hostApps}
                                    platform={platform}
                                    compact={compact}
                                    notice={notice?.index === i ? notice.text : null}
                                    onChange={(r) => update(list.map((x, k) => (k === i ? r : x)), i)}
                                    onMove={(d) => move(i, d)}
                                    onDelete={() => update(list.filter((_, k) => k !== i))}
                                />
                            ))}
                        </ol>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-kb-gray-border px-3 py-1 text-sm font-medium text-kb-ink hover:bg-kb-gray-border/40 disabled:pointer-events-none disabled:opacity-40"
                            disabled={full}
                            title={full ? `The board holds at most ${APP_RULES_MAX} rules` : "Add a rule at the end"}
                            onClick={() => update([...list, blankRule()], list.length)}
                        >
                            <Plus className="h-4 w-4" aria-hidden /> Add rule
                        </button>
                        {hostApps && (
                            <button type="button" className={iconButton} aria-label="Refresh the running apps" title="Refresh the running apps"
                                onClick={() => void fetchHostApps().then(setHostApps)}>
                                <RefreshCw className="h-4 w-4" aria-hidden />
                            </button>
                        )}
                    </div>
                    </fieldset>
                </>
            )}
        </section>
    );
}
