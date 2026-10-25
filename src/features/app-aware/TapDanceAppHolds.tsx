import "./app-aware.css";
import { useKeyboard } from "@/contexts/KeyboardContext";
import { keyService } from "@/services/key.service";
import { MATRIX_COLS } from "@/constants/svalboard-layout";
import { ALL, getState, posKey, useAppAware } from "./store";

/**
 * Tap Dances panel, prototype only: a small mark on a tap dance's Hold slot
 * naming the apps that change that hold (App Taps apply to the hold slot too).
 */
export function TapDanceAppHolds({ index }: { index: number }) {
    const st = getState();
    if (!st.on || !st.supported) return null;
    return <TapDanceAppHoldsOn index={index} />;
}

function TapDanceAppHoldsOn({ index }: { index: number }) {
    const s = useAppAware();
    const { keyboard } = useKeyboard();
    if (!s.on || !s.supported || !keyboard?.keymap) return null;
    const code = keyService.parse(`TD(${index})`);
    const positions: string[] = [];
    keyboard.keymap.forEach((layer, l) => layer.forEach((k, i) => {
        if (Number(k) === code) positions.push(posKey(l, Math.floor(i / MATRIX_COLS), i % MATRIX_COLS));
    }));
    const apps = s.apps.filter(a => a.id !== ALL && positions.some(p => s.holds[a.id]?.[p]));
    if (!apps.length) return null;
    const label = `Hold changed in ${apps.map(a => a.name).join(", ")}`;
    return (
        <span
            className="kb-app-own-chip absolute -bottom-1.5 -right-2 rounded-full px-1 text-[9px] font-semibold leading-[13px] pointer-events-auto"
            title={label}
            aria-label={label}
            data-td-app-holds={index}
        >+{apps.length}</span>
    );
}
