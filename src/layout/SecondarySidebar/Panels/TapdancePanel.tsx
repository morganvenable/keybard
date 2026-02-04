import React from "react";
import { Key } from "@/components/Key";

import SidebarItemRow from "@/layout/SecondarySidebar/components/SidebarItemRow";
import { useKeyBinding } from "@/contexts/KeyBindingContext";
import { useLayer } from "@/contexts/LayerContext";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { usePanels } from "@/contexts/PanelsContext";
import { useVial } from "@/contexts/VialContext";
import { hoverBackgroundClasses, hoverBorderClasses, hoverHeaderClasses } from "@/utils/colors";
import { getKeyContents } from "@/utils/keys";
import { KeyContent } from "@/types/vial.types";

const TapdancePanel: React.FC = () => {
    const { keyboard } = useVial();
    const { assignKeycode } = useKeyBinding();
    const { selectedLayer } = useLayer();
    const { layoutMode } = useLayoutSettings();
    const {
        setItemToEdit,
        setBindingTypeToEdit,
        setAlternativeHeader,
    } = usePanels();

    const isHorizontal = layoutMode === "bottombar";

    if (!keyboard) return null;

    const layerColorName = keyboard?.cosmetic?.layer_colors?.[selectedLayer] || "primary";
    const hoverBorderColor = hoverBorderClasses[layerColorName] || hoverBorderClasses["primary"];
    const hoverBackgroundColor = hoverBackgroundClasses[layerColorName] || hoverBackgroundClasses["primary"];
    const hoverHeaderClass = hoverHeaderClasses[layerColorName] || hoverHeaderClasses["primary"];

    const tapdances = keyboard.tapdances || [];

    const handleEdit = (index: number) => {
        setItemToEdit(index);
        setBindingTypeToEdit("tapdances");
        setAlternativeHeader(true);
    };

    // Shared small key renderer
    const renderSmallKey = (content: KeyContent, idx: number, tdIndex: number) => {
        const hasContent =
            (content?.top && content?.top !== "KC_NO") ||
            (content?.str && content?.str !== "" && content?.str !== "KC_NO");

        return (
            <div className="w-[30px] h-[30px] relative" key={idx}>
                <Key
                    isRelative
                    x={0}
                    y={0}
                    w={1}
                    h={1}
                    row={-1}
                    col={-1}
                    keycode={content?.top || "KC_NO"}
                    label={content?.str || ""}
                    keyContents={content}
                    variant="small"
                    layerColor={hasContent ? "sidebar" : undefined}
                    className={
                        !hasContent ? "bg-transparent border border-kb-gray-border" : "border-kb-gray"
                    }
                    headerClassName={!hasContent ? "hidden" : "bg-kb-sidebar-dark"}
                    onClick={() => handleEdit(tdIndex)}
                    disableTooltip={true}
                />
            </div>
        );
    };

    // Horizontal grid layout for bottom panel
    if (isHorizontal) {
        return (
            <div className="flex flex-row gap-3 h-full items-start pt-2">
                {tapdances.map((tdEntry, i) => {
                    const td = tdEntry || ({} as any);
                    const states = [
                        { label: "Tap", key: td.tap },
                        { label: "Hold", key: td.hold },
                        { label: "T-H", key: td.taphold },
                        { label: "Dbl", key: td.doubletap },
                    ];
                    const stateContents = states.map((s) => getKeyContents(keyboard, s.key) as KeyContent);
                    const hasAssignment = stateContents.some(
                        (k) => (k?.top && k.top !== "KC_NO") || (k?.str && k.str !== "KC_NO" && k.str !== "")
                    );

                    if (!hasAssignment) return null;

                    const tdKeycode = `TD(${i})`;
                    const tdKeyContents = getKeyContents(keyboard, tdKeycode) as KeyContent;

                    return (
                        <div
                            key={i}
                            className="flex flex-col bg-gray-50 rounded-lg p-2 cursor-pointer hover:bg-gray-100 transition-colors min-w-[100px]"
                            onClick={() => handleEdit(i)}
                        >
                            {/* Header row with draggable TD key and label */}
                            <div className="flex flex-row items-center gap-2 mb-2">
                                <div className="w-[30px] h-[30px] relative" onClick={(e) => e.stopPropagation()}>
                                    <Key
                                        isRelative
                                        x={0}
                                        y={0}
                                        w={1}
                                        h={1}
                                        row={-1}
                                        col={-1}
                                        keycode={tdKeycode}
                                        label={i.toString()}
                                        keyContents={tdKeyContents}
                                        variant="small"
                                        layerColor="sidebar"
                                        className="border-kb-gray"
                                        headerClassName="bg-kb-sidebar-dark"
                                        onClick={() => assignKeycode(tdKeycode)}
                                        disableTooltip={true}
                                    />
                                </div>
                                <span className="text-xs font-bold text-slate-600">TD {i}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                                {stateContents.map((content, idx) => (
                                    <div key={idx} className="flex flex-col items-center">
                                        <span className="text-[8px] text-gray-400 mb-0.5">{states[idx].label}</span>
                                        {renderSmallKey(content, idx, i)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
                {tapdances.filter(td => {
                    const states = [td?.tap, td?.hold, td?.taphold, td?.doubletap];
                    return states.some(k => k && k !== "KC_NO");
                }).length === 0 && (
                        <div className="text-center text-gray-500 py-4 px-6">
                            No tapdances configured.
                        </div>
                    )}
            </div>
        );
    }

    // Vertical list layout for sidebar (original)
    return (
        <div className="space-y-3 pt-3 pb-8 relative">
            {/* Header Row - Sticky */}
            <div className="sticky top-0 z-20 bg-white pt-4 pb-4 -mt-4 flex flex-row items-end pl-12 pr-12 mb-2">
                <div className="flex-grow flex flex-row justify-between w-full max-w-[240px] ml-6">
                    <span className="text-xs font-bold text-center w-[30px]">Tap</span>
                    <span className="text-xs font-bold text-center w-[30px]">Hold</span>
                    <span className="text-xs font-bold text-center w-[30px] whitespace-nowrap">Tap-Hold</span>
                    <span className="text-xs font-bold text-center w-[30px] whitespace-nowrap">Double-Tap</span>
                </div>
            </div>

            <div className="flex flex-col">
                {tapdances.map((tdEntry, i) => {
                    const keycode = `TD(${i})`;
                    const keyContents = getKeyContents(keyboard, keycode) as KeyContent;

                    // Use tdEntry directly from the map
                    const td = tdEntry || ({} as any);
                    const states = [
                        { label: "Tap", key: td.tap },
                        { label: "Hold", key: td.hold },
                        { label: "TapHold", key: td.taphold },
                        { label: "Double", key: td.doubletap },
                    ];

                    const stateContents = states.map((s) => getKeyContents(keyboard, s.key) as KeyContent);

                    // Check if any key is actually assigned (not just KC_NO/empty)
                    const hasAssignment = stateContents.some(
                        (k) => (k?.top && k.top !== "KC_NO") || (k?.str && k.str !== "KC_NO" && k.str !== "")
                    );

                    const rowChildren = hasAssignment ? (
                        <div className="flex flex-row gap-4 w-full max-w-[240px] ml-6 justify-between">
                            {stateContents.map((content, idx) => renderSmallKey(content, idx, i))}
                        </div>
                    ) : undefined;

                    return (
                        <SidebarItemRow
                            key={i}
                            index={i}
                            keyboard={keyboard}
                            keycode={keycode}
                            label={i.toString()}
                            keyContents={keyContents}
                            onEdit={handleEdit}
                            onAssignKeycode={assignKeycode}
                            hoverBorderColor={hoverBorderColor}
                            hoverBackgroundColor={hoverBackgroundColor}
                            hoverLayerColor={layerColorName}
                            hoverHeaderClass={hoverHeaderClass}
                        >
                            {rowChildren}
                        </SidebarItemRow>
                    );
                })}
                {tapdances.length === 0 && (
                    <div className="text-center text-gray-500 mt-10">
                        No tapdances found.
                    </div>
                )}
            </div>
        </div>
    );
};

export default TapdancePanel;
