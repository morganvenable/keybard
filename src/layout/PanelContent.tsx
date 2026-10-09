import AltRepeatPanel from "./SecondarySidebar/Panels/AltRepeatPanel";
import BasicKeyboards from "./SecondarySidebar/Panels/BasicKeyboards";
import CombosPanel from "./SecondarySidebar/Panels/CombosPanel";
import DynamicMenuPanel from "./SecondarySidebar/Panels/DynamicMenuPanel";
import LayoutsPanel from "./SecondarySidebar/Panels/LayoutsPanel";
import LeadersPanel from "./SecondarySidebar/Panels/LeadersPanel";
import LayersPanel from "./SecondarySidebar/Panels/LayersPanel";
import MacrosPanel from "./SecondarySidebar/Panels/MacrosPanel";
import SpecialKeysPanel from "./SecondarySidebar/Panels/SpecialKeysPanel/SpecialKeysPanel";
import OverridesPanel from "./SecondarySidebar/Panels/OverridesPanel";
import PointingPanel from "./SecondarySidebar/Panels/PointingPanel";
import OneShotComposerPanel from "./SecondarySidebar/Panels/OneShotComposerPanel";
import QmkKeyPanel from "./SecondarySidebar/Panels/QmkKeysPanel";
import MousePanel from "./SecondarySidebar/Panels/MousePanel";
import QMKSettingsPanel from "./SecondarySidebar/Panels/QMKSettingsPanel";
import ScanLabPanel from "./SecondarySidebar/Panels/ScanLabPanel";
import SettingsPanel from "./SecondarySidebar/Panels/SettingsPanel";
import TapdancePanel from "./SecondarySidebar/Panels/TapdancePanel";
import AboutPanel from "./SecondarySidebar/Panels/AboutPanel";
import QuickStartPanel from "./SecondarySidebar/Panels/QuickStartPanel";

import FragmentsPanel from "./SecondarySidebar/Panels/FragmentsPanel";
import PracticePanel from "@/features/practice/PracticePanel";
import OverlayPanel from "@/features/trainer/OverlayPanel";
import type { CustomUIMenuItem } from "@/types/keyboard.types";
import type { PracticePage } from "./workspaces";

export const getPanelTitle = (panel: string | null | undefined, menus?: CustomUIMenuItem[], practicePage?: PracticePage): string => {
    if (!panel) return "Details";

    // Practice's panel follows its page (docs/practice/spec.md §5.13).
    if (panel === "practice") return practicePage === "progress" ? "Progress" : "Lesson";

    // Handle dynamic menu panels
    if (panel.startsWith("dynamic-menu-")) {
        const indexStr = panel.replace("dynamic-menu-", "");
        const index = parseInt(indexStr, 10);
        if (!isNaN(index) && menus && menus[index]) {
            return menus[index].label || `Menu ${index}`;
        }
        return "Settings";
    }

    const titles: Record<string, string> = {
        keyboard: "Standard Keys",
        layers: "Layer Keys",
        tapdances: "Tap Dance Keys",
        macros: "Macro Keys",
        qmk: "One-Shot (Legacy)",
        oneshot: "One-Shot / Mod-Tap",
        special: "Special Keys",
        mouse: "Mouse Keys",
        combos: "Combos",
        overrides: "Overrides",
        altrepeat: "Alt-Repeat Keys",
        leaders: "Leader Sequences",
        layouts: "Layouts",
        pointing: "Pointing Devices",
        qmksettings: "QMK Settings",
        settings: "Settings",
        fragments: "Hardware configuration",
        scanlab: "Scan Lab",
        quickstart: "Quick Start",
        about: "About",
        overlay: "Overlay",
    };

    return titles[panel] ?? "Details";
};

export function PanelContent({ panel, horizontal = false, isPicker = false }: { panel: string | null | undefined; horizontal?: boolean; isPicker?: boolean }) {
    if (isPicker) {
        const pickers = {keyboard: BasicKeyboards, layers: LayersPanel, macros: MacrosPanel, qmk: QmkKeyPanel, oneshot: OneShotComposerPanel, special: SpecialKeysPanel, pointing: PointingPanel, mouse: MousePanel};
        const Picker = pickers[panel as keyof typeof pickers] ?? BasicKeyboards;
        return <Picker isPicker />;
    }
    if (panel?.startsWith("dynamic-menu-")) {
        const index = Number(panel.slice("dynamic-menu-".length));
        if (Number.isInteger(index) && index >= 0) return <DynamicMenuPanel menuIndex={index} horizontal={horizontal} />;
    }
    const panels = {
        keyboard: BasicKeyboards, layers: LayersPanel, tapdances: TapdancePanel,
        macros: MacrosPanel, combos: CombosPanel, overrides: OverridesPanel,
        altrepeat: AltRepeatPanel, leaders: LeadersPanel, fragments: FragmentsPanel,
        layouts: LayoutsPanel, pointing: PointingPanel, qmk: QmkKeyPanel,
        oneshot: OneShotComposerPanel, special: SpecialKeysPanel, mouse: MousePanel,
        qmksettings: QMKSettingsPanel, scanlab: ScanLabPanel, settings: SettingsPanel,
        quickstart: QuickStartPanel, about: AboutPanel,
    };
    if (panel === "practice") return <PracticePanel horizontal={horizontal} />;
    if (panel === "overlay") return <OverlayPanel horizontal={horizontal} />;
    const Content = panels[panel as keyof typeof panels];
    return Content ? <Content /> : <p className="p-4 text-sm text-muted-foreground">Select a panel to view its settings.</p>;
}
