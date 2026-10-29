import { useEffect } from "react";

import { useKeyboard } from "@/contexts/KeyboardContext";
import { usePanels } from "@/contexts/PanelsContext";
import { useOpenBindingEditor } from "@/hooks/useOpenBindingEditor";
import { claimEditStart, claimTesterStart, EDIT_PANELS, editFromSearch, editTargetExists, testerFromSearch } from "@/lib/deepLinks";

/**
 * ?tester opens the matrix tester. ?edit=combo:N | tapdance:N | macro:N: opens that editor once a layout is
 * loaded, as a click on its row would. Once per page load; an entry the
 * layout does not have is ignored.
 */
export default function DeepLinkEditor() {
    const { keyboard } = useKeyboard();
    const openEditor = useOpenBindingEditor();
    const { setActivePanel, setPanelToGoBack, setItemToEdit } = usePanels();

    // ?tester: open the matrix tester once a layout is loaded, as its button does.
    useEffect(() => {
        if (!keyboard || !testerFromSearch(window.location.search) || !claimTesterStart()) return;
        setActivePanel("matrixtester");
        setPanelToGoBack(null);
        setItemToEdit(null);
    }, [keyboard, setActivePanel, setPanelToGoBack, setItemToEdit]);

    useEffect(() => {
        if (!keyboard) return;
        const target = editFromSearch(window.location.search);
        if (!target) return;
        const counts = {
            combos: keyboard.combos?.length ?? keyboard.combo_count ?? 0,
            tapdances: keyboard.tapdances?.length ?? keyboard.tapdance_count ?? 0,
            macros: keyboard.macros?.length ?? keyboard.macro_count ?? 0,
        };
        if (!editTargetExists(target, counts) || !claimEditStart()) return;
        openEditor(EDIT_PANELS[target.kind], target.index);
    }, [keyboard, openEditor]);

    return null;
}
