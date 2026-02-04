import { Key } from "@/components/Key";
import EditorKey from "@/layout/SecondarySidebar/components/EditorKey";
import React from "react";
import { useDrag } from "@/contexts/DragContext";
import MacrosIcon from "@/components/icons/MacrosIcon";
import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { colorClasses } from "@/utils/colors";

// Reusing styles from EditorKey roughly to ensure it looks identical
const classes = {
    key: "bg-white border-2 border-kb-gray-border w-12 h-12 rounded-md flex flex-col items-center justify-center shadow-lg pointer-events-none z-[9999]",
    emptyKey:
        "bg-kb-green text-white w-12 h-12 rounded-md border-2 border-transparent flex items-center justify-center text-wrap text-center text-xs flex-col shadow-lg pointer-events-none z-[9999]",
};

export const DragOverlay: React.FC = () => {
    const { isDragging, draggedItem, dragPosition } = useDrag();

    if (!isDragging || !draggedItem) return null;

    // Use dimensions if provided (Key.tsx provides exact pixel dimensions), otherwise default (EditorKey 48px)
    // For layers, we use auto sizing
    const isLayer = draggedItem.component === "Layer";
    const width = isLayer ? "auto" : (draggedItem.width || 48);
    const height = isLayer ? "auto" : (draggedItem.height || 48);

    // We position the overlay so its center matches the cursor
    const style: React.CSSProperties = {
        position: "fixed",
        left: `${dragPosition.x}px`,
        top: `${dragPosition.y}px`,
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        transform: 'translate(-50%, -50%)',
        pointerEvents: "none",
        zIndex: 9999,
    };

    const renderContent = () => {
        if (draggedItem.component === "Key" && draggedItem.props) {
            return <Key {...draggedItem.props as any} disableTooltip={true} />;
        }
        if (draggedItem.component === "EditorKey" && draggedItem.props) {
            return <EditorKey {...draggedItem.props as any} />;
        }
        if (draggedItem.component === "Layer" && draggedItem.layerData) {
            // Layer drag visualization
            const layerColor = draggedItem.layerData.layerColor;
            const colorClass = layerColor ? colorClasses[layerColor] || "bg-blue-500" : "bg-blue-500";
            return (
                <div className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg border-2 border-white",
                    colorClass
                )}>
                    <Layers className="w-5 h-5 text-white" />
                    <span className="text-white font-medium text-sm whitespace-nowrap">
                        {draggedItem.layerData.name}
                    </span>
                </div>
            );
        }

        // Fallback for any other items or legacy path
        const displayText = draggedItem.label || draggedItem.keycode;
        const isMacro = draggedItem.type === "macro";
        const keyClass = displayText !== "" ? classes.emptyKey : classes.key;

        return (
            <div className={cn(keyClass, "border-red-600 !w-full !h-full shadow-none")}>
                {isMacro && <MacrosIcon className="mt-2 h-8" />}
                {displayText && <span style={{ whiteSpace: "pre-line" }}>{displayText}</span>}
            </div>
        );
    };

    return (
        <div style={style} className="shadow-lg rounded-md bg-white">
            {renderContent()}
        </div>
    );
};
