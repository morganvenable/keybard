import "./app-aware.css";
import { cn } from "@/lib/utils";
import type { KeyboardInfo } from "@/types/keyboard.types";
import { keyService } from "@/services/key.service";
import { shortKeyName } from "@/utils/combo-labels";
import { useOpenBindingEditor } from "@/hooks/useOpenBindingEditor";
import { useKeyBinding } from "@/contexts/KeyBindingContext";
import { useKeyboard } from "@/contexts/KeyboardContext";
import { MATRIX_COLS } from "@/constants/svalboard-layout";
import { COMMON_ACTIONS, NO_HOLD, shortcutText } from "./catalog";
import { AppMono } from "./AppMenu";
import {
    ALL, appName, clearHold, getState, layerName, nativeHold, openMenu, posKey, resolveHold, selectApp, setHold, setPickMode, undoWarning,
    useAppAware, type AppAwareState,
} from "./store";

/** Tap / Hold: what the picker (and typing) writes for the selected key. */
export function TapHoldSwitch({ tapName, holdLabel, holdShort, className }: { tapName: string; holdLabel: string; holdShort: string; className?: string }) {
    const s = useAppAware();
    return (
        <div className={cn("flex items-center gap-1 rounded-lg bg-kb-combo-chip p-0.5 w-max max-w-full", className)} role="radiogroup" aria-label="Edit">
            {(["tap", "hold"] as const).map(m => (
                <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={s.pickMode === m}
                    data-pick-mode={m}
                    onClick={(e) => { e.stopPropagation(); setPickMode(m); }}
                    className={cn(
                        "rounded-md px-2.5 py-1 text-[12.5px] whitespace-nowrap transition-colors",
                        s.pickMode === m ? "bg-kb-surface text-kb-ink shadow-sm font-semibold" : "text-muted-foreground hover:text-kb-ink",
                    )}
                >
                    {m === "tap" ? <>Tap <span className="font-semibold">{tapName}</span></> : <>{holdLabel}{holdShort ? <span className="font-semibold">: {holdShort}</span> : ""}</>}
                </button>
            ))}
        </div>
    );
}

/** The same switch at the top of the picker panel, for the selected layout key. */
export function PickTargetSwitch({ className }: { className?: string }) {
    // Off without the flag, before any context hook (panels render in tests without providers).
    const st = getState();
    if (!st.on || !st.supported) return null;
    return <PickTargetSwitchOn className={className} />;
}

function PickTargetSwitchOn({ className }: { className?: string }) {
    const s = useAppAware();
    const { selectedTarget } = useKeyBinding();
    const { keyboard } = useKeyboard();
    if (!s.on || !s.supported || !keyboard || selectedTarget?.type !== "keyboard") return null;
    const { layer, row, col } = selectedTarget;
    if (layer === undefined || row === undefined || col === undefined) return null;
    const pos = posKey(layer, row, col);
    if (s.placed[pos]) return null;
    const name = keyService.stringify(Number(keyboard.keymap?.[layer]?.[row * MATRIX_COLS + col] ?? 0));
    if (name === "KC_TRNS" || name === "KC_NO") return null;
    const r = resolveHold(s.selectedApp, pos, nativeHold(keyboard, name), s);
    const app = s.selectedApp;
    return (
        <div data-pick-target="">
            <TapHoldSwitch
                className={className}
                tapName={tapNameFor(keyboard, name)}
                holdLabel={app === ALL ? "Hold" : `Hold in ${appName(app)}`}
                holdShort={r.hold ? r.hold.short || r.hold.name : ""}
            />
        </div>
    );
}

const FULL: Record<string, string> = {
    KC_BSPACE: "Backspace", KC_BSPC: "Backspace", KC_SPACE: "Space", KC_SPC: "Space", KC_LEFT: "Left arrow",
    KC_RIGHT: "Right arrow", KC_UP: "Up arrow", KC_DOWN: "Down arrow", KC_DELETE: "Delete", KC_DEL: "Delete",
};
const keyFullName = (k: string) => FULL[k] ?? shortKeyName(k);

/** The tap legend for the switch: a tap dance's tap slot, a mod-tap's or layer-tap's tap key. */
function tapNameFor(keyboard: KeyboardInfo, name: string): string {
    const td = /^TD\((\d+)\)$/.exec(name)?.[1];
    if (td !== undefined) {
        const tap = keyboard.tapdances?.[Number(td)]?.tap;
        return tap && tap !== "KC_NO" ? shortKeyName(tap) : `Tap dance ${td}`;
    }
    return shortKeyName(name.replace(/^(\w+_T|LT\d+)\((.+)\)$/, "$2"));
}

export interface HoldKeyRef { layer: number; row: number; col: number; code: number }

function holdText(s: AppAwareState, name: string | undefined, code: string | undefined): string {
    if (!name) return "None";
    const sc = code && code.startsWith("PRI(") ? shortcutText(code, s.os) : "";
    return sc ? `${name} · ${sc}` : name;
}

/** Key card section: Tap / Hold switch, one-click holds, and this key's hold in every app. */
export function KeyHoldSection(props: { keyboard: KeyboardInfo; k: HoldKeyRef; pinned: boolean }) {
    const st = getState();
    if (!st.on || !st.supported) return null;
    return <KeyHoldSectionOn {...props} />;
}

function KeyHoldSectionOn({ keyboard, k, pinned }: { keyboard: KeyboardInfo; k: HoldKeyRef; pinned: boolean }) {
    const s = useAppAware();
    const openEditor = useOpenBindingEditor();
    if (!s.on || !s.supported) return null;
    const pos = posKey(k.layer, k.row, k.col);
    const name = keyService.stringify(k.code);
    if (name === "KC_TRNS" || name === "KC_NO") return null;
    if (s.placed[pos]) return null;
    const native = nativeHold(keyboard, name);
    const tdIndex = /^TD\((\d+)\)$/.exec(name)?.[1];
    const tapName = tapNameFor(keyboard, name);
    const app = s.selectedApp;
    const here = resolveHold(app, pos, native, s);
    const own = app !== ALL && here.source === "app";
    const holdLabel = app === ALL ? "Hold" : `Hold in ${appName(app)}`;
    const warning = s.warning?.pos === pos ? s.warning : null;

    const rows: { id: string; label: string; mono?: string; value: string; own: boolean; note?: string }[] = [];
    const allR = resolveHold(ALL, pos, native, s);
    rows.push({
        id: ALL, label: "All apps", value: holdText(s, allR.hold?.name, allR.hold?.code),
        own: app === ALL,
        note: tdIndex !== undefined && allR.source === "native" ? `Tap dance ${tdIndex}'s hold` : undefined,
    });
    for (const a of s.apps) {
        const r = resolveHold(a.id, pos, native, s);
        rows.push({
            id: a.id, label: a.name, mono: a.mono,
            value: r.source === "app" ? (r.hold ? holdText(s, r.hold.name, r.hold.code) : "No hold") : "Same as All apps",
            own: r.source === "app",
            note: a.baseLayer !== null && a.baseLayer !== k.layer ? `On ${layerName(a.baseLayer)}` : undefined,
        });
    }

    return (
        <section className="mt-2.5" data-inspector-section="holds" data-app-hold-card="">
            {pinned && <TapHoldSwitch tapName={tapName} holdLabel={holdLabel} holdShort={here.hold ? here.hold.short || here.hold.name : ""} />}
            {pinned && s.pickMode === "hold" && (
                <div className="mt-2 flex flex-wrap items-center gap-1" data-hold-actions="">
                    {COMMON_ACTIONS.map(a => (
                        <button
                            key={a.name}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setHold(pos, a, name); }}
                            aria-pressed={here.hold?.code === a.code}
                            className={cn(
                                "rounded-[5px] border px-1.5 h-[22px] text-[11.5px] font-medium",
                                here.hold?.code === a.code ? "border-kb-ink bg-kb-active text-kb-active-fg" : "border-kb-combo-chip-border bg-kb-combo-chip text-kb-ink hover:border-kb-ink",
                            )}
                            title={shortcutText(a.code, s.os)}
                            data-hold-action={a.name}
                        >{a.name}</button>
                    ))}
                    {app !== ALL && !(own && !here.hold) && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); setHold(pos, NO_HOLD); }} className="rounded-[5px] border border-kb-combo-chip-border px-1.5 h-[22px] text-[11.5px] text-kb-ink hover:border-kb-ink" data-hold-none="">
                            No hold in {appName(app)}
                        </button>
                    )}
                    {app === ALL && here.source === "all" && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); clearHold(pos, ALL); }} className="rounded-[5px] border border-kb-combo-chip-border px-1.5 h-[22px] text-[11.5px] text-kb-ink hover:border-kb-ink" data-hold-remove="">
                            {native ? "Back to the key's own hold" : "Remove hold"}
                        </button>
                    )}
                    {own && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); clearHold(pos); }} className="rounded-[5px] border border-kb-ink px-1.5 h-[22px] text-[11.5px] font-semibold text-kb-ink" data-hold-same="">
                            Same as All apps
                        </button>
                    )}
                    <span className="text-[11px] text-muted-foreground pl-1">or pick any key</span>
                </div>
            )}
            {warning && (
                <div className="kb-warn mt-2 rounded-md px-2 py-1.5 text-[12px] flex items-center gap-2" role="status" data-hold-warning="">
                    <span className="flex-1">Holding {keyFullName(warning.key)} won't repeat now. Tap, then hold, to repeat.</span>
                    <button type="button" className="underline font-semibold" onClick={(e) => { e.stopPropagation(); undoWarning(); }}>Undo</button>
                </div>
            )}
            <h3 className="mt-2.5 text-[12px] font-medium text-muted-foreground m-0">{s.apps.length ? "Hold in each app" : "Hold"}</h3>
            <ul className="list-none mt-1 p-0 grid gap-1" data-hold-everywhere="">
                {rows.map(r => (
                    <li key={r.id} data-inspector-row="" data-hold-row={r.id}>
                        {/* Clicking a row edits that app's hold on this key. */}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); selectApp(r.id); setPickMode("hold"); }}
                            aria-pressed={r.id === app}
                            title={r.id === app ? undefined : `Edit the hold in ${r.label}`}
                            className={cn(
                                "w-full grid grid-cols-[18px_96px_1fr] items-center gap-x-2 min-h-6 rounded-md px-1 -mx-1 text-left text-[13px]",
                                r.id === app ? "bg-kb-combo-row-lit" : "hover:bg-kb-combo-row-lit",
                            )}
                            data-hold-row-select={r.id}
                        >
                            <span className="inline-flex justify-center">{r.mono ? <AppMono mono={r.mono} size={16} /> : null}</span>
                            <span className={cn("truncate text-[12.5px]", r.id === app ? "text-kb-ink font-semibold" : "text-muted-foreground")}>{r.label}</span>
                            <span className="flex items-center gap-1.5 min-w-0">
                                <span className={cn("truncate", r.id !== ALL && !r.own && "text-muted-foreground", r.id !== ALL && r.own && "font-semibold")}>{r.value}</span>
                                {r.id !== ALL && r.own && <span className="kb-app-own-chip rounded px-1 text-[10px] font-semibold" data-own-mark="">Own</span>}
                                {r.note && <span className="text-[11px] text-muted-foreground whitespace-nowrap">{r.note}</span>}
                            </span>
                        </button>
                    </li>
                ))}
                <li>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openMenu("add"); }}
                        className="w-full grid grid-cols-[18px_1fr] items-center gap-x-2 min-h-6 rounded-md px-1 -mx-1 text-left text-[12.5px] text-muted-foreground hover:bg-kb-combo-row-lit hover:text-kb-ink"
                        data-hold-add-app=""
                    >
                        <span className="inline-flex justify-center">+</span>
                        <span>Add app</span>
                    </button>
                </li>
            </ul>
            {tdIndex !== undefined && pinned && (
                <button type="button" className="mt-1.5 text-[12px] underline text-kb-ink" onClick={(e) => { e.stopPropagation(); openEditor("tapdances", Number(tdIndex)); }} data-edit-tapdance="">
                    Double tap and tap-then-hold: edit Tap dance {tdIndex}
                </button>
            )}
        </section>
    );
}
