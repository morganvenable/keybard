import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, RefreshCw, Trash2 } from "lucide-react";

import { LayerPill } from "@/components/LayerPill";
import { useChanges } from "@/contexts/ChangesContext";
import { useKeyboard } from "@/contexts/KeyboardContext";
import { fetchHostApps, type HostApps, type HostPlatform } from "@/features/trainer/host-apps";
import { isMacOS } from "@/lib/platform";
import { pickableLayers } from "@/utils/automouse-layers";
import { cn } from "@/lib/utils";
import {
    APP_MASK_LAYERS, APP_RULE_LABEL_BYTES, APP_RULES_MAX, appId, appIdHex, cycleMask, hasAppRules, maskState,
    readAppForeground, truncateUtf8, writeAppRules,
} from "@/services/app-rules";
import { svalService } from "@/services/sval.service";
import { usbInstance } from "@/services/usb.service";
import type { AppRule, KeyboardInfo } from "@/types/keyboard.types";
import { rememberAppKeys } from "@/utils/app-rule-keys";

/** How long a burst of edits waits before the rules are written once (BEGIN, WRITE, COMMIT). */
export const APP_RULES_WRITE_DELAY_MS = 500;

const PLATFORM_HINTS: Record<HostPlatform, { name: string; what: string; example: string }> = {
    windows: { name: "Windows", what: "the program's file name", example: "notepad.exe" },
    macos: { name: "macOS", what: "the bundle ID", example: "com.apple.Safari" },
    linux: { name: "Linux", what: "the app ID or WM_CLASS", example: "firefox" },
};

function guessPlatform(): HostPlatform {
    if (isMacOS()) return "macos";
    const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
    return /linux|x11|cros/i.test(ua) && !/android/i.test(ua) ? "linux" : "windows";
}

const layerName = (keyboard: KeyboardInfo, layer: number) => svalService.getLayerNameNoLabel(keyboard, layer);

const blankRule = (): AppRule => ({ appId: 0, defaultLayer: null, frontLayer: null, onMask: 0, offMask: 0, flags: 0, label: "", key: "" });

const PILL_TEXT = {
    neutral: { aria: "unchanged", title: "left as you set it. Click to turn it on while the app is in front" },
    on: { aria: "turned on", title: "turned on while the app is in front. Click to turn it off instead" },
    off: { aria: "turned off", title: "turned off while the app is in front. Click to leave it as you set it" },
} as const;

const fieldClass = "h-8 min-w-0 rounded-md border border-input bg-kb-surface px-2 text-sm text-kb-ink";
const iconButton = "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-kb-gray-border/40 hover:text-kb-ink disabled:pointer-events-none disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-kb-ink";

function LayerSelect({ keyboard, label, value, onChange, testId }: {
    keyboard: KeyboardInfo; label: string; value: number | null; onChange: (layer: number | null) => void; testId: string;
}) {
    const count = keyboard.layers || APP_MASK_LAYERS;
    return (
        <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-xs text-muted-foreground">
            {label}
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

function RuleCard({ keyboard, rule, index, count, active, hostApps, platform, compact, onChange, onMove, onDelete }: {
    keyboard: KeyboardInfo; rule: AppRule; index: number; count: number; active: boolean;
    hostApps: HostApps | null; platform: HostPlatform; compact: boolean;
    onChange: (rule: AppRule) => void; onMove: (delta: number) => void; onDelete: () => void;
}) {
    const hint = PLATFORM_HINTS[platform];
    const key = rule.key ?? "";
    const unknown = !key && rule.appId !== 0;
    const setKey = (next: string) => {
        const oldDefault = truncateUtf8(key.trim());
        const label = !rule.label || rule.label === oldDefault ? truncateUtf8(next.trim()) : rule.label;
        onChange({ ...rule, key: next, appId: appId(next), label });
    };
    const layers = Math.min(keyboard.layers || APP_MASK_LAYERS, APP_MASK_LAYERS);
    const n = index + 1;
    return (
        <li
            className={cn("flex flex-col gap-2 rounded-lg border border-kb-gray-border bg-kb-surface p-3", compact && "w-[340px] shrink-0 gap-1.5 p-2")}
            data-app-rule={index}
            aria-label={`Rule ${n}`}
        >
            <div className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-center text-xs font-semibold text-muted-foreground" title="Rules are checked in order; the first that matches applies">{n}</span>
                <div className="flex min-w-0 flex-1 items-center gap-1">
                    <input
                        type="text"
                        aria-label={`Rule ${n} app`}
                        data-testid="app-rule-key"
                        spellCheck={false}
                        autoComplete="off"
                        className={cn(fieldClass, "w-full font-mono")}
                        value={key}
                        placeholder={unknown ? `${rule.label || "Unknown app"} (ID ${appIdHex(rule.appId)})` : hint.example}
                        title={`${hint.name}: ${hint.what}, like ${hint.example}`}
                        onChange={(e) => setKey(e.target.value)}
                    />
                    {hostApps && hostApps.apps.length > 0 && (
                        <select
                            aria-label={`Rule ${n}: pick a running app`}
                            data-testid="app-rule-pick"
                            title="Pick an app running on this computer"
                            className={cn(fieldClass, "w-24 shrink-0 cursor-pointer")}
                            value=""
                            onChange={(e) => { if (e.target.value) setKey(e.target.value); }}
                        >
                            <option value="">Running…</option>
                            {hostApps.apps.map((a) => (
                                <option key={a.key} value={a.key}>{a.name === a.key ? a.key : `${a.name} (${a.key})`}</option>
                            ))}
                        </select>
                    )}
                </div>
                {active && (
                    <span className="shrink-0 rounded-full bg-kb-active px-2 py-0.5 text-[10px] font-semibold text-kb-active-fg" data-testid="app-rule-active" title="The app in front now matches this rule">
                        Applies now
                    </span>
                )}
                <div className="flex shrink-0 items-center">
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
            <div className={cn("flex items-end gap-2", compact ? "pl-0" : "pl-7")}>
                <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-xs text-muted-foreground">
                    Label
                    <input
                        type="text"
                        aria-label={`Rule ${n} label`}
                        data-testid="app-rule-label"
                        className={fieldClass}
                        value={rule.label}
                        title={`Shown when Keybard doesn't know the app; at most ${APP_RULE_LABEL_BYTES} bytes`}
                        onChange={(e) => onChange({ ...rule, label: truncateUtf8(e.target.value) })}
                    />
                </label>
                <LayerSelect keyboard={keyboard} label="Default layer" testId="app-rule-default" value={rule.defaultLayer}
                    onChange={(defaultLayer) => onChange({ ...rule, defaultLayer })} />
                <LayerSelect keyboard={keyboard} label="Turn on layer" testId="app-rule-front" value={rule.frontLayer}
                    onChange={(frontLayer) => onChange({ ...rule, frontLayer })} />
            </div>
            <div className={cn("flex flex-col gap-0.5", compact ? "pl-0" : "pl-7")}>
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
    const ref = useRef<HTMLElement>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latest = useRef<AppRule[] | null>(null);
    const queueRef = useRef(queue);
    queueRef.current = queue;

    const supported = !!keyboard && hasAppRules(keyboard.feature_flags5);
    const rules = keyboard?.app_rules;

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
            await writeAppRules(usbInstance, next);
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
        setKeyboard((cur) => cur?.app_rules ? { ...cur, app_rules: cur.app_rules.map((r) => (!r.key && byId.has(r.appId) ? { ...r, key: byId.get(r.appId) } : r)) } : cur);
    }, [hostApps, rules, setKeyboard]);

    if (!keyboard || !supported) return null;

    const platform = hostApps?.platform ?? guessPlatform();
    const hint = PLATFORM_HINTS[platform];

    const update = (next: AppRule[]) => {
        rememberAppKeys(next.map((r) => r.key ?? ""));
        setKeyboard((cur) => (cur ? { ...cur, app_rules: next } : cur));
        if (!isConnected) return;
        latest.current = next;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(flush, APP_RULES_WRITE_DELAY_MS);
    };

    const list = rules ?? [];
    const full = list.length >= APP_RULES_MAX;
    const move = (i: number, delta: number) => {
        const j = i + delta;
        if (j < 0 || j >= list.length) return;
        const next = [...list];
        [next[i], next[j]] = [next[j], next[i]];
        update(next);
    };

    return (
        <section ref={ref} className="flex flex-col gap-2" data-app-rules aria-labelledby="app-rules-title">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 id="app-rules-title" className={cn("font-semibold text-kb-ink", compact ? "text-base" : "text-lg", inPanel && "sr-only")}>App Layers</h3>
                <span className="text-xs text-muted-foreground" data-testid="app-rules-count">{list.length} of {APP_RULES_MAX} max</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground max-w-prose">
                Change layers while an app is in front. Keybard Host tells the board which app that is; the first rule that matches applies,
                and leaving the app puts your layers back. Name the app by {hint.what} on {hint.name}, like <span className="font-mono">{hint.example}</span>.
            </p>
            {!rules ? (
                <p role="alert" className="text-sm text-kb-warn-ink">Keybard couldn't read the app rules from the board. Reconnect to try again.</p>
            ) : (
                <>
                    {list.length > 0 && (
                        <ol className={cn("flex gap-2", compact ? "flex-row overflow-x-auto pb-1" : "flex-col")}>
                            {list.map((rule, i) => (
                                <RuleCard
                                    key={i}
                                    keyboard={keyboard}
                                    rule={rule}
                                    index={i}
                                    count={list.length}
                                    active={activeRule === i}
                                    hostApps={hostApps}
                                    platform={platform}
                                    compact={compact}
                                    onChange={(r) => update(list.map((x, k) => (k === i ? r : x)))}
                                    onMove={(d) => move(i, d)}
                                    onDelete={() => update(list.filter((_, k) => k !== i))}
                                />
                            ))}
                        </ol>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md border border-kb-gray-border px-3 py-1 text-sm font-medium text-kb-ink hover:bg-kb-gray-border/40 disabled:pointer-events-none disabled:opacity-40"
                            disabled={full}
                            title={full ? `The board holds at most ${APP_RULES_MAX} rules` : "Add a rule at the end"}
                            onClick={() => update([...list, blankRule()])}
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
                </>
            )}
        </section>
    );
}
