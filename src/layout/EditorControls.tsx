import React from "react";
import { cn } from "@/lib/utils";
import { PanelBottom, PanelRight } from "lucide-react";
import { InfoIcon } from "@/components/icons/InfoIcon";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
// import { useVial } from "@/contexts/VialContext";

interface EditorControlsProps {
    showInfoPanel: boolean;
    setShowInfoPanel: (show: boolean) => void;
    showInfoToggle?: boolean;
    children?: React.ReactNode;
}

export const EditorControls: React.FC<EditorControlsProps> = ({
    showInfoPanel,
    setShowInfoPanel,
    showInfoToggle = true,
    children
}) => {
    const {
        keyVariant,
        setKeyVariant,
        isAutoKeySize,
        setIsAutoKeySize,
        isAutoLayoutMode,
        setIsAutoLayoutMode,
        layoutMode,
        setLayoutMode
    } = useLayoutSettings();
    // const { resetToOriginal } = useVial();

    return (
        <div className="flex flex-wrap justify-end items-center gap-2 max-w-full">

            <div className="flex flex-row items-center gap-0.5 bg-gray-200/50 p-0.5 rounded-md border border-gray-300/50 w-fit">
                {(['default', 'medium', 'small'] as const).map((variant) => (
                    <button
                        key={variant}
                        onClick={(e) => {
                            e.stopPropagation();
                            setKeyVariant(variant);
                        }}
                        className={cn(
                            "px-2 py-0.5 text-xs uppercase tracking-wide rounded-[4px] transition-all font-semibold border select-none",
                            keyVariant === variant && !isAutoKeySize
                                ? "bg-black text-white shadow-sm border-black"
                                : keyVariant === variant && isAutoKeySize
                                    ? "bg-gray-400 text-white border-gray-400"
                                    : "text-gray-500 border-transparent hover:text-gray-900 hover:bg-gray-300/50"
                        )}
                        aria-pressed={keyVariant === variant && !isAutoKeySize}
                        title={`Set key size to ${variant}`}
                    >
                        {variant === 'default' ? 'Normal' : variant}
                    </button>
                ))}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsAutoKeySize(true);
                    }}
                    className={cn(
                        "px-2 py-0.5 text-xs uppercase tracking-wide rounded-[4px] transition-all font-semibold border select-none",
                        isAutoKeySize
                            ? "bg-black text-white shadow-sm border-black"
                            : "text-gray-500 border-transparent hover:text-gray-900 hover:bg-gray-300/50"
                    )}
                    aria-pressed={isAutoKeySize}
                    title="Auto size based on window"
                >
                    Auto
                </button>
            </div>

            <div className="flex flex-row items-center gap-0.5 bg-gray-200/50 p-0.5 rounded-md border border-gray-300/50 w-fit">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsAutoLayoutMode(false);
                        setLayoutMode("sidebar");
                    }}
                    className={cn(
                        "p-1 rounded-[4px] transition-all border",
                        layoutMode === "sidebar" && !isAutoLayoutMode
                            ? "bg-black text-white shadow-sm border-black"
                            : "text-gray-500 border-transparent hover:text-gray-900 hover:bg-gray-300/50"
                    )}
                    aria-label="Sidebar layout"
                    aria-pressed={layoutMode === "sidebar" && !isAutoLayoutMode}
                    title="Sidebar layout"
                >
                    <PanelRight className="h-3.5 w-3.5" />
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsAutoLayoutMode(false);
                        setLayoutMode("bottombar");
                    }}
                    className={cn(
                        "p-1 rounded-[4px] transition-all border",
                        layoutMode === "bottombar" && !isAutoLayoutMode
                            ? "bg-black text-white shadow-sm border-black"
                            : "text-gray-500 border-transparent hover:text-gray-900 hover:bg-gray-300/50"
                    )}
                    aria-label="Bottom bar layout"
                    aria-pressed={layoutMode === "bottombar" && !isAutoLayoutMode}
                    title="Bottom bar layout"
                >
                    <PanelBottom className="h-3.5 w-3.5" />
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsAutoLayoutMode(true);
                    }}
                    className={cn(
                        "px-1.5 py-0.5 text-xs uppercase tracking-wide rounded-[4px] transition-all font-semibold border select-none",
                        isAutoLayoutMode
                            ? "bg-black text-white shadow-sm border-black"
                            : "text-gray-500 border-transparent hover:text-gray-900 hover:bg-gray-300/50"
                    )}
                    aria-pressed={isAutoLayoutMode}
                    title="Auto-switch layout based on window size"
                >
                    Auto
                </button>
            </div>

            {showInfoToggle && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowInfoPanel(!showInfoPanel);
                    }}
                    className={cn(
                        "p-1 rounded-[4px] transition-all border",
                        showInfoPanel
                            ? "bg-black text-white shadow-sm border-black"
                            : "text-gray-500 border-transparent hover:text-gray-900 hover:bg-gray-300/50"
                    )}
                    aria-label={showInfoPanel ? "Hide Key Info" : "Show Key Info"}
                    aria-expanded={showInfoPanel}
                    title={showInfoPanel ? "Hide Key Info" : "Show Key Info"}
                >
                    <InfoIcon className="h-3.5 w-3.5" />
                </button>
            )}
            {children}
        </div>
    );
};
