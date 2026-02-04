import "./BottomPanel.css";

import * as React from "react";

import AltRepeatPanel from "../SecondarySidebar/Panels/AltRepeatPanel";
import BasicKeyboards from "../SecondarySidebar/Panels/BasicKeyboards";
import CombosPanel from "../SecondarySidebar/Panels/CombosPanel";
import DynamicMenuPanel from "../SecondarySidebar/Panels/DynamicMenuPanel";
import FragmentsPanel from "../SecondarySidebar/Panels/FragmentsPanel";
import LayoutsPanel from "../SecondarySidebar/Panels/LayoutsPanel";
import LeadersPanel from "../SecondarySidebar/Panels/LeadersPanel";
import LayersPanel from "../SecondarySidebar/Panels/LayersPanel";
import MacrosPanel from "../SecondarySidebar/Panels/MacrosPanel";
import SpecialKeysPanel from "../SecondarySidebar/Panels/SpecialKeysPanel/SpecialKeysPanel";
import OverridesPanel from "../SecondarySidebar/Panels/OverridesPanel";
import PointingPanel from "../SecondarySidebar/Panels/PointingPanel";
import OneShotComposerPanel from "../SecondarySidebar/Panels/OneShotComposerPanel";
import QmkKeyPanel from "../SecondarySidebar/Panels/QmkKeysPanel";
import MousePanel from "../SecondarySidebar/Panels/MousePanel";
import QMKSettingsPanel from "../SecondarySidebar/Panels/QMKSettingsPanel";
import SettingsPanel from "../SecondarySidebar/Panels/SettingsPanel";
import TapdancePanel from "../SecondarySidebar/Panels/TapdancePanel";
import { PickerMode } from "../SecondarySidebar/components/EditorSidePanel";

import { usePanels } from "@/contexts/PanelsContext";
import { cn } from "@/lib/utils";
export const BOTTOM_PANEL_HEIGHT = 230;

interface BottomPanelProps {
    leftOffset?: string;
    pickerMode?: PickerMode;
    height?: number;
}

/**
 * Bottom Panel - Horizontal panel that shows at the bottom of the screen
 * in bottom bar layout mode. Shows the same content as SecondarySidebar
 * but in a horizontal layout optimized for small screens.
 *
 * When editing (itemToEdit !== null), shows key pickers controlled by pickerMode.
 */
const BottomPanel: React.FC<BottomPanelProps> = ({ leftOffset, pickerMode, height }) => {
    const { activePanel, state, itemToEdit } = usePanels();
    const panelHeight = height ?? BOTTOM_PANEL_HEIGHT;

    // Check if we're in editor mode
    const isEditing = itemToEdit !== null &&
        ["tapdances", "combos", "macros", "overrides", "altrepeat", "leaders"].includes(activePanel || "");

    const isOpen = state === "expanded" && activePanel !== null && activePanel !== "matrixtester";

    const renderPickerContent = () => {
        switch (pickerMode) {
            case "keyboard": return <BasicKeyboards isPicker />;
            case "layers": return <LayersPanel isPicker />;
            case "macros": return <MacrosPanel isPicker />;
            case "qmk": return <QmkKeyPanel isPicker />;
            case "oneshot": return <OneShotComposerPanel isPicker />;
            case "special": return <SpecialKeysPanel isPicker />;
            case "mouse": return <MousePanel isPicker />;
            default: return <BasicKeyboards isPicker />;
        }
    };

    const renderContent = () => {
        // If editing, show the picker content
        if (isEditing && pickerMode) {
            return renderPickerContent();
        }

        if (!activePanel) {
            return (
                <div className="flex items-center justify-center h-full text-center text-sm text-muted-foreground px-6">
                    Select a panel from the sidebar to view options.
                </div>
            );
        }

        // Handle dynamic menu panels
        if (activePanel.startsWith("dynamic-menu-")) {
            const indexStr = activePanel.replace("dynamic-menu-", "");
            const menuIndex = parseInt(indexStr, 10);
            if (!isNaN(menuIndex)) {
                return <DynamicMenuPanel menuIndex={menuIndex} horizontal />;
            }
        }

        switch (activePanel) {
            case "keyboard": return <BasicKeyboards />;
            case "layers": return <LayersPanel />;
            case "tapdances": return <TapdancePanel />;
            case "macros": return <MacrosPanel />;
            case "combos": return <CombosPanel />;
            case "overrides": return <OverridesPanel />;
            case "altrepeat": return <AltRepeatPanel />;
            case "leaders": return <LeadersPanel />;
            case "fragments": return <FragmentsPanel />;
            case "layouts": return <LayoutsPanel />;
            case "pointing": return <PointingPanel />;
            case "qmk": return <QmkKeyPanel />;
            case "oneshot": return <OneShotComposerPanel />;
            case "special": return <SpecialKeysPanel />;
            case "mouse": return <MousePanel />;
            case "qmksettings": return <QMKSettingsPanel />;
            case "settings": return <SettingsPanel />;
            default:
                return (
                    <div className="flex items-center justify-center h-full text-center text-sm text-muted-foreground px-6">
                        {`Content for "${activePanel}" will appear here.`}
                    </div>
                );
        }
    };

    return (
        <div
            className={cn(
                "bottom-panel fixed right-0 bottom-0 bg-white border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] z-20 transition-all duration-300 ease-in-out",
                isOpen ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
            )}
            style={{
                height: panelHeight,
                left: leftOffset ? `calc(${leftOffset} + 8px)` : 0,
            }}
        >
            {/* Content area - allows both horizontal and vertical scrolling for wrapped content */}
            <div className="bottom-panel-content h-full overflow-auto px-4 py-2">
                <div className="bottom-panel-inner h-full">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default BottomPanel;
