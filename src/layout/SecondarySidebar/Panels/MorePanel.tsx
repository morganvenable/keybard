import React from "react";
import { ArrowRight } from "lucide-react";

import AltRepeatArrowsIcon from "@/components/icons/AltRepeatArrowsIcon";
import { usePanels } from "@/contexts/PanelsContext";
import { ALT_REPEAT_PANEL } from "@/lib/altRepeatVisibility";

/** Editing tools that most people never need, each with one line on what it does. */
const MORE_TOOLS = [
    {
        panel: ALT_REPEAT_PANEL,
        title: "Alt-Repeat",
        description: "A key that types the opposite of your last key: after Ctrl+Z, it sends Ctrl+Y.",
        Icon: AltRepeatArrowsIcon,
    },
];

const MorePanel: React.FC = () => {
    const { setActivePanel, setPanelToGoBack, setAlternativeHeader, setItemToEdit } = usePanels();

    const open = (panel: string) => {
        setActivePanel(panel);
        setPanelToGoBack(null);
        setAlternativeHeader(false);
        setItemToEdit(null);
    };

    return (
        <div className="flex flex-col gap-2 p-4">
            {MORE_TOOLS.map(({ panel, title, description, Icon }) => (
                <button
                    key={panel}
                    type="button"
                    onClick={() => open(panel)}
                    className="group flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar p-3 text-left text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
                >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-semibold">{title}</span>
                        <span className="text-sm text-muted-foreground">{description}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
            ))}
        </div>
    );
};

export default MorePanel;
