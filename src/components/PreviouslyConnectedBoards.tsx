import { useEffect, useState } from "react";
import { PlugZap } from "lucide-react";
import { listPermittedDevices } from "@/contexts/KeyboardContext";

/** Boards already authorized for this origin, using Keybard's direct-connect flow. */
export default function PreviouslyConnectedBoards({ enabled = true, disabled = false, refreshKey, onConnect, excludeDevice, label = "or reconnect without the chooser" }: {
    excludeDevice?: (device: HIDDevice) => boolean;
    label?: string;
    enabled?: boolean;
    disabled?: boolean;
    refreshKey?: unknown;
    onConnect: (device: HIDDevice) => void;
}) {
    const [devices, setDevices] = useState<HIDDevice[]>([]);
    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        const refresh = () => {
            void listPermittedDevices().then(found => {
                if (!cancelled) setDevices(found);
            }).catch(() => { if (!cancelled) setDevices([]); });
        };
        refresh();
        navigator.hid?.addEventListener?.("connect", refresh);
        navigator.hid?.addEventListener?.("disconnect", refresh);
        window.addEventListener("focus", refresh);
        return () => {
            cancelled = true;
            navigator.hid?.removeEventListener?.("connect", refresh);
            navigator.hid?.removeEventListener?.("disconnect", refresh);
            window.removeEventListener("focus", refresh);
        };
    }, [enabled, refreshKey]);
    const available = devices.filter(device => !excludeDevice?.(device));
    if (!enabled || available.length === 0) return null;
    return <div className="flex flex-col gap-1 w-full max-w-sm mx-auto" data-testid="known-devices">
        <span className="text-[11px] text-muted-foreground text-center">{label}</span>
        {available.map((device, index) => <button
            type="button"
            key={`${device.vendorId}:${device.productId}:${index}`}
            onClick={() => onConnect(device)}
            disabled={disabled}
            className="flex items-center justify-center gap-2 text-sm font-medium cursor-pointer transition-all bg-kb-gray-medium text-slate-700 dark:text-neutral-200 hover:bg-kb-surface dark:hover:bg-neutral-700 px-5 py-1.5 rounded-full w-full disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="known-device"
        ><PlugZap className="h-4 w-4 shrink-0" /><span className="break-words min-w-0">{device.productName || `Keyboard ${device.productId.toString(16)}`}</span></button>)}
    </div>;
}
