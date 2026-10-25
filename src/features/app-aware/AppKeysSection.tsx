import { Key } from "@/components/Key";
import { useKeyBinding } from "@/contexts/KeyBindingContext";
import { APP_PAUSE_KEY, APP_TYPE_KEY } from "./assign";
import { getState, useAppAware } from "./store";

/** Layer Keys panel, prototype only: the Type and Pause keys for app base layers. */
export function AppKeysSection({ compact = false }: { compact?: boolean }) {
    const st = getState();
    if (!st.on || !st.supported) return null;
    return <AppKeysSectionOn compact={compact} />;
}

function AppKeysSectionOn({ compact }: { compact: boolean }) {
    const s = useAppAware();
    const { assignKeycode, selectedTarget } = useKeyBinding();
    if (!s.on || !s.supported) return null;
    const canPlace = selectedTarget?.type === "keyboard";
    const keys = [
        { code: APP_TYPE_KEY, label: "Type", title: "Type: flips between the app's layer and home" },
        { code: APP_PAUSE_KEY, label: "Pause", title: "Pause: app switching off until pressed again" },
    ];
    return (
        <section className={compact ? "flex items-center gap-2" : "mt-4 flex flex-col gap-2"} data-app-keys="">
            <span className="text-md font-medium text-kb-ink">App layer keys</span>
            <div className="flex gap-2">
                {keys.map(k => (
                    <Key
                        key={k.code}
                        x={0} y={0} w={1} h={1} row={-1} col={-1}
                        keycode={k.code}
                        label={k.label}
                        layerColor="sidebar"
                        headerClassName="bg-kb-sidebar-dark"
                        isRelative
                        variant={compact ? "medium" : "default"}
                        title={k.title}
                        disableDrag
                        onClick={() => { if (canPlace) assignKeycode(k.code); }}
                        data-app-key={k.code}
                    />
                ))}
            </div>
        </section>
    );
}
