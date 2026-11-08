import MouseKeysSection from "./MouseKeysSection";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { useKeyboard } from "@/contexts/KeyboardContext";
import DescriptionBlock from "@/layout/SecondarySidebar/components/DescriptionBlock";
import { usePanels } from "@/contexts/PanelsContext";
import { requestSettingsSection } from "./settings/anchor";

/**
 * Unified Pointing Devices panel
 * - When disconnected: shows placeholder text
 * - When connected: shows the Mouse Keys section (mouse buttons, sniper, boost,
 *   scrolling) and one line linking to Settings > Pointing, where pointer speed,
 *   scroll speed, gestures and the auto mouse layer are set once
 * - As a picker (isPicker): renders the SAME content as the main panel so any
 *   assignable pointing-device key is available. The picker bypasses the
 *   "not connected" gate because the keys work whether the board was connected
 *   live or loaded from a file.
 *
 * All assignable keys render through MouseKeysSection so they share one size
 * (user key-size setting in the sidebar, compact/medium in the bottom bar).
 * Do not add ad-hoc <Key> rows here; add them to MouseKeysSection instead.
 */
interface Props {
    isPicker?: boolean;
}

const PointingPanel = ({ isPicker }: Props) => {
    const { isConnected, connect } = useKeyboard();
    const { layoutMode } = useLayoutSettings();
    const isHorizontal = layoutMode === "bottombar";

    const { setActivePanel } = usePanels();
    // The firmware's pointing menu no longer renders here: its settings are Settings > Pointing.
    const openPointingSettings = () => {
        requestSettingsSection("pointing");
        setActivePanel("settings");
    };
    const settingsLink = (
        <button type="button" onClick={openPointingSettings} className="underline underline-offset-2 hover:text-foreground transition-all text-inherit" data-pointing-settings-link>
            Settings &rsaquo; Pointing
        </button>
    );

    // Not connected (skipped in picker mode — the keys don't need a live connection)
    if (!isConnected && !isPicker) {
        return (
            <section className="h-full flex flex-col pt-2">
                <DescriptionBlock>
                    <button
                        onClick={() => connect()}
                        className="underline underline-offset-2 hover:text-foreground transition-all text-inherit"
                    >
                        Connect
                    </button>
                    {" keyboard to use its pointing devices."}
                </DescriptionBlock>
            </section>
        );
    }

    // Horizontal layout for bottom panel
    if (isHorizontal) {
        return (
            <div className="flex flex-row gap-3 items-start flex-wrap content-start">
                <MouseKeysSection compact variant="medium" />
                {!isPicker && <p className="text-xs text-muted-foreground self-center">Speed, gestures and auto mouse: {settingsLink}</p>}
            </div>
        );
    }

    // Vertical layout for sidebar
    return (
        <section className="flex flex-col">
            <div>
                <DescriptionBlock>
                    Mouse buttons, pointer speed changes and scroll keys.
                    {!isPicker && <> Pointer speed, scroll speed, gestures and the auto mouse layer are set once in {settingsLink}.</>}
                </DescriptionBlock>
                {/* Mouse Keys section: mouse buttons, sniper, boost, scrolling */}
                <div className="pb-4">
                    <MouseKeysSection />
                </div>
            </div>
        </section>
    );
};

export default PointingPanel;
