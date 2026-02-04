import LayersDefaultIcon from "@/components/icons/LayersDefault";
import MacrosIcon from "@/components/icons/MacrosIcon";
import MouseIcon from "@/components/icons/Mouse";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { cn } from "@/lib/utils";
import { FC } from "react";

import { Keyboard, Piano } from "lucide-react";

export type PickerMode = "keyboard" | "layers" | "macros" | "qmk" | "oneshot" | "special" | "mouse";

const iconsToShow: { icon: React.ReactNode; panel: PickerMode; title: string }[] = [
    {
        icon: <Keyboard className="w-4 h-4" />,
        panel: "keyboard",
        title: "Keyboard Keys",
    },
    {
        icon: <Piano className="w-4 h-4" />,
        panel: "special",
        title: "Special Keys",
    },
    {
        icon: <LayersDefaultIcon className="w-4 h-4" />,
        panel: "layers",
        title: "Layer Keys",
    },
    {
        icon: <MouseIcon className="w-4 h-4" />,
        panel: "mouse",
        title: "Mouse Keys",
    },
    {
        icon: <MacrosIcon className="w-4 h-4" />,
        panel: "macros",
        title: "Macros",
    },
];

interface Props {
    className?: string;
    activeTab?: PickerMode;
    onTabChange?: (tab: PickerMode) => void;
    showMacros?: boolean;
    horizontal?: boolean;
}

const EditorSidePanel: FC<Props> = ({ className, activeTab, onTabChange, showMacros = true, horizontal = false }) => {
    const visibleIcons = showMacros ? iconsToShow : iconsToShow.filter((i) => i.panel !== "macros");

    if (horizontal) {
        return (
            <div className={cn("w-full items-center justify-center flex", className)}>
                <div className="flex items-center flex-row justify-center gap-1">
                    {visibleIcons.map((i) => (
                        <Tooltip key={i.panel}>
                            <TooltipTrigger asChild>
                                <button
                                    className={cn(
                                        "cursor-pointer transition-colors px-3 py-2 rounded-md flex items-center gap-2",
                                        activeTab === i.panel
                                            ? "bg-black text-white"
                                            : "text-gray-500 hover:text-slate-900 hover:bg-gray-100"
                                    )}
                                    onClick={() => {
                                        if (onTabChange) {
                                            onTabChange(i.panel);
                                        }
                                    }}
                                >
                                    {i.icon}
                                    <span className="text-xs font-medium">{i.title}</span>
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                {i.title}
                            </TooltipContent>
                        </Tooltip>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className={cn("items-start justify-start flex", className)}>
            <div
                className="bg-white rounded-r-[18px] text-gray-400 flex items-center flex-col justify-start py-3 px-2 gap-1 shadow-[4px_0_16px_rgba(0,0,0,0.1)] border-l-0"
                style={{ clipPath: "inset(-50px -50px -50px 0px)" }}
            >
                {visibleIcons.map((i) => (
                    <Tooltip key={i.panel}>
                        <TooltipTrigger asChild>
                            <div
                                key={i.panel}
                                className={cn(
                                    "cursor-pointer transition-colors px-2 py-3 h-10 w-10 items-center justify-center flex",
                                    activeTab === i.panel ? "text-slate-900" : "text-gray-400 hover:text-slate-900"
                                )}
                                onClick={() => {
                                    if (onTabChange) {
                                        onTabChange(i.panel);
                                    }
                                }}
                            >
                                {i.icon}
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                            {i.title}
                        </TooltipContent>
                    </Tooltip>
                ))}
            </div>
        </div>
    );
};

export default EditorSidePanel;
