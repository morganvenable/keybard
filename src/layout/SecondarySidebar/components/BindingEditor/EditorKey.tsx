import { FC } from "react";
import { Trash2 } from "lucide-react";
import { Key } from "@/components/Key";
import { useVial } from "@/contexts/VialContext";
import { useLayer } from "@/contexts/LayerContext";
import { getKeyContents } from "@/utils/keys";
import { hoverBackgroundClasses, hoverBorderClasses } from "@/utils/colors";

interface EditorKeyProps {
    keycode: string;
    label?: string; // Additional label to display (e.g. "Output", "1", "2")
    selected?: boolean;
    onClick: () => void;
    onClear?: () => void;
    size?: string; // Class for size, e.g. "w-[60px] h-[60px]"
    trashOffset?: string; // Class for trash icon positioning e.g. "-left-10"
    trashSize?: string; // Class for trash icon size e.g. "w-4 h-4"
    variant?: "default" | "medium" | "small";
    labelClassName?: string; // Class for the label text
    wrapperClassName?: string; // Class for the wrapper div
    showTrash?: boolean; // Whether the trash icon is enabled (defaults to true if onClear is provided)
}

const EditorKey: FC<EditorKeyProps> = ({
    keycode,
    label,
    selected = false,
    onClick,
    onClear,
    size = "w-[60px] h-[60px]",
    trashOffset = "-left-10",
    trashSize = "w-4 h-4",
    variant = "default",
    labelClassName = "text-sm font-bold text-slate-600",
    wrapperClassName = "flex flex-col items-center gap-1 relative",
    showTrash = true
}) => {
    const { keyboard } = useVial();
    const { selectedLayer } = useLayer();

    const layerColorName = keyboard?.cosmetic?.layer_colors?.[selectedLayer] || "primary";
    const hoverBorderColor = hoverBorderClasses[layerColorName] || hoverBorderClasses["primary"];
    const hoverBackgroundColor = hoverBackgroundClasses[layerColorName] || hoverBackgroundClasses["primary"];

    const keyContents = getKeyContents(keyboard!, keycode);
    // Determine if the key has actual content assigned
    // Check both for non-KC_NO keycode and for valid string content
    const hasContent = (keyContents?.top && keyContents.top !== "KC_NO") ||
        (keyContents?.str && keyContents.str !== "KC_NO" && keyContents.str !== "");

    let keyColor: string | undefined;
    let keyClassName: string;
    let headerClass: string;

    if (selected) {
        keyColor = undefined;
        keyClassName = "border-2 border-red-600";
        headerClass = "bg-black/20";
    } else if (hasContent) {
        keyColor = "sidebar";
        keyClassName = "border-kb-gray";
        headerClass = "bg-kb-sidebar-dark";
    } else {
        keyColor = undefined;
        // Dashed border for empty slots in sequencers works well, but standard solid border is often used too.
        // Unifying to the solid border style seen in ComboEditor/OverrideEditor unless forced otherwise.
        // LeaderEditor used dashed for sequence, but we can standardize.
        // Let's stick to the common pattern:
        keyClassName = "bg-transparent border-2 border-black";

        // Wait, LeaderEditor used dashed gray for empty sequence keys. 
        // Logic from LeaderEditor:
        // keyClassName = "bg-transparent border-2 border-dashed border-gray-300";
        // Logic from Combo/Override:
        // keyClassName = "bg-transparent border-2 border-black";

        // To be safe and cleaner, if it's "sidebar" context usually we want the black border.
        // I will use the override prop pattern if we really need dashed, but for now defaults to black border.
        // Actually LeaderEditor looks better with dashed for empty optional slots. 
        // But for consistency let's stick to what Combo/Override use for now, or maybe make it a prop?
        // Let's stick to the Combo/Override default for now.
        headerClass = "text-black";
    }

    return (
        <div className={wrapperClassName}>
            {label && <span className={labelClassName}>{label}</span>}
            <div className={`relative ${size} group/editorkey`}>
                <Key
                    isRelative
                    x={0} y={0} w={1} h={1} row={-1} col={-1}
                    keycode={keycode || "KC_NO"}
                    label={keyContents?.str || ""}
                    keyContents={keyContents}
                    selected={selected}
                    onClick={() => {
                        onClick();
                    }}
                    layerColor={keyColor}
                    className={keyClassName}
                    headerClassName={headerClass}
                    hoverBorderColor={hoverBorderColor}
                    hoverBackgroundColor={hoverBackgroundColor}
                    hoverLayerColor={layerColorName}
                    variant={variant}
                    disableTooltip={true}
                />

                {hasContent && showTrash && onClear && (
                    <div className={`absolute ${trashOffset} top-0 h-full flex items-center justify-center opacity-0 group-hover/editorkey:opacity-100 transition-opacity`}>
                        <button
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full"
                            onClick={(e) => {
                                e.stopPropagation();
                                onClear();
                            }}
                            title="Clear key"
                            type="button"
                        >
                            <Trash2 className={trashSize} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EditorKey;
