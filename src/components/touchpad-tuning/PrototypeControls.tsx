import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { listPermittedDevices, useKeyboard } from "@/contexts/KeyboardContext";
import { cn } from "@/lib/utils";
import { ptpPrototype } from "@/services/ptp-prototype.service";
import {
    availableOptions, configOf, MODE_OPTIONS, SCROLL_OPTIONS, SURFACE_OPTIONS, surfacePending,
    type ProtoConfig, type ProtoOption, type ProtoState,
} from "@/utils/ptp-prototype";

type Key = keyof ProtoConfig;

interface SegmentProps {
    name: Key;
    label: string;
    options: readonly ProtoOption[];
    value: number;
    supported: number;
    disabled: boolean;
    onChange: (v: number) => void;
    hint?: ReactNode;
}

function Segment({ name, label, options, value, supported, disabled, onChange, hint }: SegmentProps) {
    const labelId = `ptp-proto-${name}-label`;
    const allowed = new Set(availableOptions(options, supported, value).map((o) => o.value));
    return (
        <div className="flex flex-col gap-1 rounded-md px-3 py-2 panel-layer-item" data-proto-control={name}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-kb-ink" id={labelId}>{label}</span>
                <div role="radiogroup" aria-labelledby={labelId} className="flex rounded-full border border-kb-gray-border p-0.5">
                    {options.map((o) => {
                        const off = disabled || !allowed.has(o.value);
                        return (
                            <button key={o.value} type="button" role="radio" aria-checked={value === o.value} disabled={off}
                                onClick={() => { if (o.value !== value) onChange(o.value); }}
                                className={cn("rounded-full px-3 py-1 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed",
                                    value === o.value ? "bg-kb-active text-kb-active-fg" : "text-muted-foreground enabled:hover:text-kb-ink",
                                    off && value !== o.value && "opacity-50")}
                                data-value={o.value} data-unsupported={!allowed.has(o.value) || undefined}>
                                {o.label}
                            </button>
                        );
                    })}
                </div>
            </div>
            {hint}
        </div>
    );
}

/**
 * The touchpad prototype controls (dev firmware only): scroll, sniper and
 * boost take effect at once; the surface is stored and applies after the
 * board restarts, so choosing it restarts the board. Read from the board when
 * shown; every reply is the board's state. Shown only when the board answers
 * the dev command with its prototype block.
 */
export function PrototypeControls() {
    const { keyboard, isConnected, connectDevice } = useKeyboard();
    const loaded = isConnected && !!keyboard;
    const [state, setState] = useState<ProtoState | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // The restart asked for after a surface change: "sent" until the board goes away and comes back.
    const [restart, setRestart] = useState<"idle" | "sent">("idle");
    const [reconnectNote, setReconnectNote] = useState<string | null>(null);
    const alive = useRef(true);
    useEffect(() => () => { alive.current = false; }, []);

    useEffect(() => {
        if (!loaded) return;
        let current = true;
        void ptpPrototype.get().then((s) => {
            if (!current || !alive.current) return;
            setState(s);
            setRestart("idle");
            setReconnectNote(null);
        });
        return () => { current = false; };
    }, [loaded]);

    const write = useCallback(async (key: Key, v: number) => {
        if (!state || busy) return;
        setBusy(true);
        setError(null);
        const result = await ptpPrototype.set({ ...configOf(state), [key]: v });
        if (!alive.current) return;
        if (result.state) setState(result.state);
        if (!result.ok) setError("The board didn't take that.");
        else if (key === "surface" && surfacePending(result.state)) {
            setRestart("sent");
            if (!(await ptpPrototype.reboot()) && alive.current) {
                setRestart("idle");
                setError("The board didn't restart.");
            }
        }
        if (alive.current) setBusy(false);
    }, [state, busy]);

    const restartNow = useCallback(async () => {
        setError(null);
        setRestart("sent");
        if (!(await ptpPrototype.reboot()) && alive.current) {
            setRestart("idle");
            setError("The board didn't restart.");
        }
    }, []);

    const reconnect = useCallback(async () => {
        setReconnectNote(null);
        const devices = await listPermittedDevices();
        const device = devices.find((d) => (d as HIDDevice & { present?: boolean }).present !== false);
        if (!device) { setReconnectNote("The board isn't back yet."); return; }
        const ok = await connectDevice(device).catch(() => false);
        if (!ok && alive.current) setReconnectNote("Replug the board to apply.");
    }, [connectDevice]);

    // Away for the restart: kept on screen with the reconnect line. Otherwise shown only while connected.
    const away = !isConnected && restart === "sent";
    if (!state || (!isConnected && !away)) return null;
    const pending = surfacePending(state);
    const disabled = busy || !isConnected || restart === "sent";
    const surfaceLabel = (v: number) => SURFACE_OPTIONS.find((o) => o.value === v)?.label ?? String(v);

    const surfaceHint = (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span data-surface-active={state.surfaceActive}>Active: {surfaceLabel(state.surfaceActive)}</span>
            {away ? (
                <span className="flex items-center gap-2" data-reconnect>
                    <span className="text-kb-ink">Reconnect to apply.</span>
                    <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => void reconnect()}>Reconnect</Button>
                    {reconnectNote && <span data-reconnect-note>{reconnectNote}</span>}
                </span>
            ) : restart === "sent" ? (
                <span className="text-kb-ink" data-restarting>Restarting the board…</span>
            ) : pending ? (
                <span className="flex items-center gap-2" data-reboot-pending>
                    <span className="text-kb-ink">Restart pending: applies after the board restarts.</span>
                    <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => void restartNow()}>Restart board</Button>
                </span>
            ) : (
                <span>Applies after the board restarts.</span>
            )}
        </div>
    );

    return (
        <section className="flex shrink-0 flex-col gap-1.5" aria-labelledby="ptp-proto-title" data-ptp-prototype>
            <h3 className="text-sm font-medium text-kb-ink" id="ptp-proto-title">Prototype</h3>
            <div className="grid gap-2 @3xl:grid-cols-2">
                <Segment name="scroll" label="Scroll toggle" options={SCROLL_OPTIONS} value={state.scroll} supported={state.supported} disabled={disabled} onChange={(v) => void write("scroll", v)} />
                <Segment name="sniper" label="Sniper" options={MODE_OPTIONS} value={state.sniper} supported={state.supported} disabled={disabled} onChange={(v) => void write("sniper", v)} />
                <Segment name="boost" label="Boost" options={MODE_OPTIONS} value={state.boost} supported={state.supported} disabled={disabled} onChange={(v) => void write("boost", v)} />
                <Segment name="surface" label="Surface" options={SURFACE_OPTIONS} value={state.surface} supported={state.supported} disabled={disabled} onChange={(v) => void write("surface", v)} hint={surfaceHint} />
            </div>
            <p className="min-h-4 text-xs text-kb-touch-cancel" role={error ? "alert" : undefined} data-proto-error={error ? true : undefined}>{error}</p>
        </section>
    );
}
