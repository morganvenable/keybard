import MacrosIcon from "@/components/icons/MacrosIcon";
import { FC, useRef, useId, useState } from "react";
import { DragItem, useDrag } from "@/contexts/DragContext";
import { cn } from "@/lib/utils";

export interface EditorKeyProps {
    label?: string;
    binding?: any;
    onClick?: () => void;
    selected?: boolean;
    onDrop?: (item: DragItem) => void;
}

const classes = {
    key: "bg-kb-surface border border-kb-gray-border border-2 w-12 h-12 rounded-md cursor-pointer hover:border-kb-select transition-all flex flex-col select-none",
    emptyKey:
        "bg-kb-green text-white w-12 h-12 rounded-md cursor-pointer hover:border-2 border-2 border border-transparent hover:border-kb-select transition-all flex items-center justify-center text-wrap text-center text-xs flex-col select-none",
    selectedKey: "!bg-kb-select-tint border-2 border-kb-select text-kb-ink",
    dragSource: "!bg-kb-light-grey border-kb-light-grey dark:!bg-neutral-700 dark:border-neutral-700 text-transparent opacity-65 select-none",
    dragHover: "!border-kb-select !bg-kb-select-tint !border-2 text-kb-ink",
};

const EditorKey: FC<EditorKeyProps> = ({ label, binding, onClick, selected, onDrop }) => {
    const { startDrag, dragSourceId, isDragging, draggedItem, markDropConsumed } = useDrag();
    const uniqueId = useId();
    const [isDragHover, setIsDragHover] = useState(false);

    // We need to keep track of the start position to determine dragged threshold
    const startPosRef = useRef<{ x: number, y: number } | null>(null);

    const keyClass = binding.str !== "" ? classes.emptyKey : classes.key;

    // Handle newlines in the display text (for user keys)
    const displayText = binding.str !== "" ? binding.str : "";

    // Check if this specific instance is being dragged
    const isDragSource = dragSourceId === uniqueId;

    // If it is the source, apply specific styles
    const effectiveClass = isDragSource
        ? cn(keyClass, classes.dragSource)
        : isDragHover && isDragging && !isDragSource
            ? cn(keyClass, classes.dragHover)
            : selected ? cn(keyClass, classes.selectedKey) : keyClass;

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return; // Only left click
        startPosRef.current = { x: e.clientX, y: e.clientY };

        // We add a temporary listener to check for drag initiation
        const checkDrag = (moveEvent: MouseEvent) => {
            const start = startPosRef.current;
            if (!start) return;

            const dx = moveEvent.clientX - start.x;
            const dy = moveEvent.clientY - start.y;

            // Threshold of 5px
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                // Start Drag
                startDrag({
                    keycode: binding.keycode || "",
                    label: label || displayText,
                    type: binding.type || "keyboard",
                    extra: binding,
                    sourceId: uniqueId,
                    width: 48, // Standard EditorKey size
                    height: 48,
                    component: "EditorKey",
                    props: {
                        label,
                        binding,
                        selected: false
                    }
                }, {
                    clientX: moveEvent.clientX,
                    clientY: moveEvent.clientY,
                } as any);

                cleanup();
            }
        };

        const handleUp = () => {
            cleanup();
        };

        const cleanup = () => {
            startPosRef.current = null;
            window.removeEventListener("mousemove", checkDrag);
            window.removeEventListener("mouseup", handleUp);
        };

        window.addEventListener("mousemove", checkDrag);
        window.addEventListener("mouseup", handleUp);
    };

    const handleMouseEnter = () => {
        if (isDragging && !isDragSource && onDrop) {
            setIsDragHover(true);
        }
    };

    const handleMouseLeave = () => {
        setIsDragHover(false);
    };

    const handleMouseUp = () => {
        if (isDragging && !isDragSource && isDragHover && draggedItem && onDrop) {
            markDropConsumed();
            onDrop(draggedItem);
            setIsDragHover(false);
        }
    };

    return (
        <div className="flex flex-row justify-start items-center">
            <div
                className={effectiveClass}
                onClick={onClick}
                onMouseDown={handleMouseDown}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onMouseUp={handleMouseUp}
            >
                {binding?.type === "macro" && <MacrosIcon className=" mt-2 h-8" />}
                {displayText && <span style={{ whiteSpace: "pre-line" }}>{displayText}</span>}
            </div>
            {label && <div className="font-medium text-gray-600 dark:text-neutral-300 px-5">{label}</div>}
        </div>
    );
};

export default EditorKey;
