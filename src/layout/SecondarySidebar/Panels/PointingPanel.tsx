import MouseKeysSection from "./MouseKeysSection";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { useKeyboard } from "@/contexts/KeyboardContext";
import DescriptionBlock from "@/layout/SecondarySidebar/components/DescriptionBlock";
import { AutoMouseSection, HandCard, ModelNotices, NoModuleLine, PointingModelProvider, SharedScrollRows, useHandCards } from "./pointing/PointingModel";

/**
 * Pointing Devices panel, top to bottom:
 * - one card per hand: its module, Pointer speed, Scroll speed, Scroll Mode
 *   (a touchpad: Gestures first) and the hand's tuner button, which opens a modal
 *   over this panel (Tune touchpad, Trackball sensors);
 * - Natural Scroll and Axis Lock, shared by both hands;
 * - the keys, most used first and all in sight (no More keys rows): Mouse Buttons,
 *   Modifiers, Sniper Keys, Boost, Scroll, TrackPoint, and DPI last;
 * - a closed AutoMouse section: the Auto Mouse settings, then the AutoMouse keys.
 * With no pointing module it says so in one line and the keys stay.
 * - When disconnected: shows placeholder text
 * - As a picker (isPicker): the SAME content as the main panel, so any assignable
 *   pointing-device key is available. The picker bypasses the "not connected"
 *   gate because the keys work whether the board was connected live or loaded
 *   from a file (the settings then have no board to read and are left out).
 * - In the bottom tray the same content is columns that scroll sideways.
 *
 * All assignable keys render through MouseKeysSection so they share one size
 * (user key-size setting in the sidebar, compact/medium in the bottom bar).
 * Do not add ad-hoc <Key> rows here; add them to MouseKeysSection instead.
 */
interface Props {
    isPicker?: boolean;
}

/** The hands, in the rail: two cards side by side where there is room. */
function RailTop() {
    const hands = useHandCards();
    return (
        <div className="flex flex-col gap-3 pb-3" data-pointing-top>
            <NoModuleLine />
            {hands.length > 0 && <div className="grid gap-3 @2xl:grid-cols-2" data-hands>{hands.map((h) => <HandCard key={h.side} hand={h} />)}</div>}
            <SharedScrollRows />
            <ModelNotices />
        </div>
    );
}

/** The same, as the tray's first columns. */
function TrayColumns() {
    const hands = useHandCards();
    return (
        <>
            <NoModuleLine />
            {hands.map((h) => <div key={h.side} className="w-[17rem] shrink-0" data-tray-column={`hand-${h.side}`}><HandCard hand={h} tray /></div>)}
            {hands.length > 0 && <div className="w-[17rem] shrink-0" data-tray-column="shared"><SharedScrollRows /></div>}
            <ModelNotices />
        </>
    );
}

const PointingPanel = ({ isPicker }: Props) => {
    const { isConnected, connect } = useKeyboard();
    const { layoutMode } = useLayoutSettings();
    const isHorizontal = layoutMode === "bottombar";

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

    // Horizontal layout for bottom panel: hands first, then the key groups, then AutoMouse.
    if (isHorizontal) {
        return (
            <PointingModelProvider>
                <div className="flex flex-row flex-nowrap gap-4 items-start overflow-x-auto pb-2" data-pointing-tray>
                    <TrayColumns />
                    <MouseKeysSection compact variant="medium" columns />
                    <div className="w-[17rem] shrink-0" data-tray-column="automouse"><AutoMouseSection tray /></div>
                </div>
            </PointingModelProvider>
        );
    }

    // Vertical layout for sidebar
    return (
        <PointingModelProvider>
            <section className="@container flex flex-col">
                <DescriptionBlock>
                    Pointer speed, scroll speed and gestures for each hand, then the keys that change them.
                </DescriptionBlock>
                <RailTop />
                <div className="pb-4">
                    <MouseKeysSection />
                </div>
                <AutoMouseSection />
            </section>
        </PointingModelProvider>
    );
};

export default PointingPanel;
