import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useKeyBinding } from "@/contexts/KeyBindingContext";
import { useKeyboard } from "@/contexts/KeyboardContext";
import { cn } from "@/lib/utils";
import { keyService } from "@/services/key.service";
import {
    OUTPUTS, TUNABLES, gestureChoice, problems, supportsTouchGestures, touchGesturesService, withGestureChoice,
    type TouchGestureStatus, type TouchGestures,
} from "@/services/touch-gestures.service";

/**
 * Touch gestures (experimental): shown in the Pointing panel only when the board
 * advertises Sval 0x2E (unified Azoteq touchpad builds). Every change is sent to
 * the board at once; the board saves it. Each gesture has one owner.
 */

// A keycode slot can be picked while this panel is closed (the user opens a key
// picker panel), so the write reads the board's current settings first.
async function writeKeycode(index: number, keycode: number): Promise<TouchGestures> {
    const current = await touchGesturesService.get();
    const keycodes = [...current.keycodes];
    keycodes[index] = keycode;
    const next = { ...current, keycodes };
    await touchGesturesService.set(next);
    listeners.forEach(fn => fn(next));
    return next;
}
const listeners = new Set<(c: TouchGestures) => void>();

function omit(d: Record<string, string>, key: string): Record<string, string> {
    const rest = { ...d };
    delete rest[key];
    return rest;
}

function parseKeycode(text: string): number | null {
    const t = text.trim();
    if (/^(0x[0-9a-f]+|\d+)$/i.test(t)) {
        const n = Number(t);
        return n >= 0 && n <= 0xffff ? n : null;
    }
    try {
        const n = keyService.parse(t);
        return Number.isInteger(n) && n >= 0 && n <= 0xffff ? n : null;
    } catch {
        return null;
    }
}

function keycodeName(kc: number): string {
    if (kc === 0) return "nothing";
    try {
        return keyService.stringify(kc);
    } catch {
        return `0x${kc.toString(16).padStart(4, "0")}`;
    }
}

interface ChoiceProps<T extends string> {
    label: string;
    value: T;
    options: ReadonlyArray<{ value: T; label: string }>;
    onChange: (value: T) => void;
    disabled?: boolean;
}

function Choice<T extends string>({ label, value, options, onChange, disabled }: ChoiceProps<T>) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-kb-ink">{label}</span>
            <div role="group" aria-label={label} className="flex flex-row rounded-full border border-border bg-muted p-0.5">
                {options.map(o => (
                    <button
                        key={o.value}
                        type="button"
                        aria-pressed={value === o.value}
                        disabled={disabled}
                        onClick={() => value !== o.value && onChange(o.value)}
                        className={cn(
                            "px-3 py-1 text-[10px] uppercase tracking-wide rounded-full font-bold transition-all",
                            value === o.value ? "bg-kb-active text-kb-active-fg shadow-sm" : "text-muted-foreground hover:text-kb-ink"
                        )}
                    >
                        {o.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

const GESTURE_OWNERS = [{ value: "off", label: "Off" }, { value: "firmware", label: "Firmware" }, { value: "windows", label: "Windows" }] as const;
const WINDOWS_OR_CHIP = [{ value: "windows", label: "Windows" }, { value: "chip", label: "Chip" }] as const;
const YES_NO = [{ value: "yes", label: "On" }, { value: "no", label: "Off" }] as const;

export default function TouchGesturesSection({ horizontal = false }: { horizontal?: boolean }) {
    const { keyboard, isConnected } = useKeyboard();
    const { selectCustomKey, selectedTarget, clearSelection } = useKeyBinding();
    const [config, setConfig] = useState<TouchGestures | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [watch, setWatch] = useState(false);
    const [status, setStatus] = useState<TouchGestureStatus | null>(null);
    const [totals, setTotals] = useState({ outputs: 0, claims: 0 });
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const mounted = useRef(true);
    const supported = isConnected && supportsTouchGestures(keyboard?.feature_flags2);

    useEffect(() => {
        mounted.current = true;
        const update = (c: TouchGestures) => mounted.current && setConfig(c);
        listeners.add(update);
        return () => { mounted.current = false; listeners.delete(update); };
    }, []);

    useEffect(() => {
        if (!supported) return;
        touchGesturesService.get().then(c => mounted.current && setConfig(c))
            .catch(e => mounted.current && setError(String(e?.message ?? e)));
    }, [supported]);

    useEffect(() => {
        if (!supported || !watch) return;
        const id = window.setInterval(() => {
            touchGesturesService.status().then(s => {
                if (!mounted.current) return;
                setStatus(s);
                setTotals(t => ({ outputs: t.outputs + s.outputs, claims: t.claims + s.claims }));
            }).catch(e => mounted.current && setError(String(e?.message ?? e)));
        }, 300);
        return () => window.clearInterval(id);
    }, [supported, watch]);

    const apply = useCallback(async (next: TouchGestures) => {
        const issues = problems(next);
        if (issues.length) { setError(issues.join("; ")); return; }
        setBusy(true);
        try {
            await touchGesturesService.set(next);
            setConfig(next);
            setError(null);
        } catch (e: any) {
            setError(String(e?.message ?? e));
        } finally {
            setBusy(false);
        }
    }, []);

    if (!supported) return null;
    if (!config) {
        return <p className="text-sm text-muted-foreground" data-testid="touch-gestures-loading">{error ?? "Reading touch gesture settings…"}</p>;
    }

    const restoreDefaults = async () => {
        setBusy(true);
        try { setConfig(await touchGesturesService.defaults()); setError(null); }
        catch (e: any) { setError(String(e?.message ?? e)); }
        finally { setBusy(false); }
    };

    const owners = (
        <div className="flex flex-col gap-2 min-w-[16rem]">
            <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Owners</h4>
            <Choice label="Two-finger scroll" value={config.scrollOwner} options={WINDOWS_OR_CHIP} disabled={busy}
                onChange={v => apply({ ...config, scrollOwner: v })} />
            <Choice label="Three-finger swipe" value={gestureChoice(config, "swipe")} options={GESTURE_OWNERS} disabled={busy}
                onChange={v => apply(withGestureChoice(config, "swipe", v))} />
            <Choice label="Pinch zoom" value={gestureChoice(config, "pinch")} options={GESTURE_OWNERS} disabled={busy}
                onChange={v => apply(withGestureChoice(config, "pinch", v))} />
            <Choice label="Firmware gestures across both pads" value={config.spanPads ? "yes" : "no"} options={YES_NO} disabled={busy}
                onChange={v => apply({ ...config, spanPads: v === "yes" })} />
            <Choice label="Always merge the pads in Windows" value={config.hostAlwaysMerge ? "yes" : "no"} options={YES_NO} disabled={busy}
                onChange={v => apply({ ...config, hostAlwaysMerge: v === "yes" })} />
        </div>
    );

    const outputs = (
        <div className="flex flex-col gap-1.5 min-w-[16rem]">
            <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Firmware outputs</h4>
            {OUTPUTS.map((o, i) => {
                const kc = config.keycodes[i];
                const picking = selectedTarget?.type === "custom" && selectedTarget.label === `touch-gesture-${i}`;
                const draft = drafts[o.key];
                return (
                    <div key={o.key} className="flex items-center gap-2" data-testid={`touch-output-${o.key}`}>
                        <span className="text-sm text-kb-ink w-24 shrink-0">{o.label}</span>
                        <button
                            type="button"
                            title="Pick a key: choose one from any key panel, or type it on your keyboard"
                            onClick={() => picking ? clearSelection() : selectCustomKey(`touch-gesture-${i}`, kc, k => {
                                writeKeycode(i, k).catch(e => mounted.current && setError(String(e?.message ?? e)));
                            })}
                            className={cn(
                                "min-w-[8rem] rounded-md border px-2 py-1 text-left text-xs font-mono truncate",
                                picking ? "border-kb-active ring-2 ring-kb-active" : "border-border hover:border-kb-ink"
                            )}
                        >
                            {picking ? "Pick a key…" : keycodeName(kc)}
                        </button>
                        <Input
                            aria-label={`${o.label} keycode`}
                            placeholder="e.g. LGUI(KC_TAB), M3, 0x094F"
                            value={draft ?? ""}
                            disabled={busy}
                            className="h-7 text-xs flex-1 min-w-[6rem]"
                            onChange={e => setDrafts(d => ({ ...d, [o.key]: e.target.value }))}
                            onKeyDown={e => {
                                if (e.key !== "Enter" || draft === undefined) return;
                                const parsed = parseKeycode(draft);
                                if (parsed === null) { setError(`${o.label}: "${draft}" isn't a keycode`); return; }
                                const keycodes = [...config.keycodes]; keycodes[i] = parsed;
                                apply({ ...config, keycodes });
                                setDrafts(d => omit(d, o.key));
                            }}
                        />
                    </div>
                );
            })}
        </div>
    );

    const tunables = (
        <div className="flex flex-col gap-1.5 min-w-[16rem]">
            <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Firmware swipe and pinch</h4>
            {TUNABLES.map(t => {
                const raw = config[t.key] as number;
                const shown = t.scale ? raw / t.scale : raw;
                const draft = drafts[t.key];
                return (
                    <label key={t.key} className="flex items-center justify-between gap-2 text-sm text-kb-ink" title={t.hint}>
                        <span>{t.label}</span>
                        <span className="flex items-center gap-1">
                            <Input
                                type="number"
                                step={t.scale && t.scale !== 1 ? 1 / t.scale : 1}
                                value={draft ?? String(shown)}
                                disabled={busy}
                                className="h-7 w-20 text-xs"
                                onChange={e => setDrafts(d => ({ ...d, [t.key]: e.target.value }))}
                                onBlur={() => {
                                    if (draft === undefined) return;
                                    const value = Math.round(Number(draft) * (t.scale ?? 1));
                                    setDrafts(d => omit(d, t.key));
                                    if (Number.isFinite(value) && value !== raw) apply({ ...config, [t.key]: value });
                                }}
                                onKeyDown={e => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                            />
                            <span className="w-6 text-xs text-muted-foreground">{t.unit ?? ""}</span>
                        </span>
                    </label>
                );
            })}
        </div>
    );

    const live = (
        <div className="flex flex-col gap-1.5 min-w-[14rem]" data-testid="touch-status">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Live</h4>
                <Button size="sm" variant="ghost" onClick={() => setWatch(w => !w)}>{watch ? "Stop" : "Watch"}</Button>
            </div>
            {status ? (
                <dl className="grid grid-cols-2 gap-x-3 text-xs text-kb-ink">
                    <dt className="text-muted-foreground">Mode</dt><dd>{status.mode}{status.handingBack ? ", handing back" : ""}</dd>
                    <dt className="text-muted-foreground">Claimed</dt><dd>{status.claimed ? "yes" : "no"}</dd>
                    <dt className="text-muted-foreground">Last gesture</dt><dd>{status.lastGesture}</dd>
                    <dt className="text-muted-foreground">Outputs / claims</dt><dd>{totals.outputs} / {totals.claims}</dd>
                    <dt className="text-muted-foreground">Fingers L / R</dt><dd>{status.contactsLeft ?? "–"} / {status.contactsRight ?? "–"}</dd>
                </dl>
            ) : <p className="text-xs text-muted-foreground">Watch shows what the firmware recognizes while you tune.</p>}
            <Button size="sm" variant="ghost" disabled={busy} onClick={restoreDefaults}>Restore defaults</Button>
        </div>
    );

    return (
        <section className={cn("flex gap-4 pt-4", horizontal ? "flex-row flex-wrap items-start" : "flex-col")} data-testid="touch-gestures">
            <div className={cn("flex flex-col gap-1", horizontal && "w-full")}>
                <h3 className="text-base font-semibold text-kb-ink">Touch gestures (experimental)</h3>
                <p className="text-xs text-muted-foreground">
                    Each gesture has one owner. Windows gestures need the unified touchpad lab running; firmware gestures type the output keys, with or without it. Changes are saved on the board.
                </p>
                {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
            </div>
            {owners}
            {outputs}
            {tunables}
            {live}
        </section>
    );
}
