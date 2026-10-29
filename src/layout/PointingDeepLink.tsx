import { useEffect, useRef } from "react";

import { useKeyboard } from "@/contexts/KeyboardContext";
import { usePanels } from "@/contexts/PanelsContext";
import { pointingDemo } from "@/features/pointing-demo";
import { requestSettingsSection, settingsSectionForPanel } from "@/layout/SecondarySidebar/Panels/settings/anchor";

/**
 * ?panel=settings opens Settings once a layout is loaded (with ?demo, the
 * QWERTY Example), so a review link lands on the Settings page. The old panel
 * names of what is now in Settings (?panel=typing, clusters, fragments, about) open
 * Settings at that section, as do ?panel=firmware and ?panel=backups. ?panel=scanlab opens the Scan Lab and ?panel=pointing
 * the Pointing Devices panel (its settings, auto mouse included). Once per page load.
 */
export default function PointingDeepLink() {
    const { keyboard } = useKeyboard();
    const { setActivePanel, openDetails, setPanelToGoBack, setItemToEdit } = usePanels();
    const done = useRef(false);
    useEffect(() => {
        const panel = pointingDemo()?.panel;
        if (!keyboard || !panel || done.current) return;
        done.current = true;
        if (panel === "scanlab" || panel === "pointing") {
            setActivePanel(panel);
            setPanelToGoBack(null);
            setItemToEdit(null);
            openDetails();
            return;
        }
        const section = settingsSectionForPanel(panel);
        if (section) requestSettingsSection(section);
        setActivePanel("settings");
        setPanelToGoBack(null);
        setItemToEdit(null);
        openDetails();
    }, [keyboard, setActivePanel, openDetails, setPanelToGoBack, setItemToEdit]);
    return null;
}
