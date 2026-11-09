import React from "react";
import DescriptionBlock from "@/layout/SecondarySidebar/components/DescriptionBlock";
import FragmentsPanel from "./FragmentsPanel";
import { usePanels } from "@/contexts/PanelsContext";

/**
 * Which key cluster sits at each finger and thumb position: a preset for the
 * whole board, then one choice per position, grouped by hand.
 */
const ClustersPanel: React.FC = () => {
    const { setActivePanel } = usePanels();
    return (
        <section className="flex flex-col">
            <DescriptionBlock>
                Match the drawn layout to the clusters and pointing modules on your board.
            </DescriptionBlock>
            <FragmentsPanel />
            <p className="px-3 pb-1 text-sm text-muted-foreground">
                {"Pointer speed, scroll and gestures are in "}
                <button type="button" onClick={() => setActivePanel("pointing")} className="underline underline-offset-2 hover:text-kb-ink text-inherit" data-pointing-devices-link>
                    Pointing Devices
                </button>
            </p>
        </section>
    );
};

export default ClustersPanel;
