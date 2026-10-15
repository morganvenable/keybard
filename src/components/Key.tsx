import React from "react";
import { KeyContent } from "@/types/keyboard.types";
import { DragItem } from "@/contexts/DragContext";
import { useKeyDrag } from "@/hooks/useKeyDrag";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { KeyFace } from "@/components/KeyFace";


export interface KeyProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick' | 'onDoubleClick' | 'title'> {
    x: number;
    y: number;
    w: number;
    h: number;
    keycode: string;
    label: string;
    row: number;
    col: number;
    layerIndex?: number;
    selected?: boolean;
    onClick?: (row: number, col: number) => void;
    onDoubleClick?: (row: number, col: number) => void;
    title?: string; // Override default tooltip
    keyContents?: KeyContent;
    layerColor?: string;
    isRelative?: boolean;
    className?: string;
    headerClassName?: string;
    variant?: "default" | "medium" | "small";
    hoverBorderColor?: string;
    hoverBackgroundColor?: string;
    hoverLayerColor?: string;
    disableHover?: boolean;
    disableTooltip?: boolean;
    hasPendingChange?: boolean;
    forceLabel?: boolean;
    dragW?: number;
    dragH?: number;
    disableDrag?: boolean;
    dragItemData?: Partial<DragItem>;
    style?: React.CSSProperties;
    unitSize?: number;
}

/**
 * Renders a single key in the keyboard layout: KeyFace plus drag, hover and click handling.
 */
export const Key = React.forwardRef<HTMLDivElement, KeyProps>((props, ref) => {
    const {
        x, y, w, h, keycode, label, row, col, layerIndex = 0, layerColor = "primary",
        selected = false, onClick, onDoubleClick, title, keyContents,
        isRelative = false, className = "", headerClassName = "bg-black/30", variant = "default",
        hoverBorderColor, hoverBackgroundColor, hoverLayerColor, disableHover = false,
        hasPendingChange = false, forceLabel = false, dragW, dragH, disableDrag = false,
        style, unitSize,
        ...rest
    } = props;

    const uniqueId = React.useId();
    const drag = useKeyDrag({
        uniqueId, keycode, label, row, col, layerIndex, layerColor,
        isRelative, keyContents, w, h, dragW, dragH, variant, onClick, disableHover, disableDrag,
        dragItemData: props.dragItemData,
        unitSize
    });
    const { internationalLayout } = useLayoutSettings();

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onClick?.(row, col);
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDoubleClick?.(row, col);
    };

    const { disableTooltip, dragItemData: _dragItemData, ...faceRest } = rest as typeof rest & { disableTooltip?: boolean; dragItemData?: Partial<DragItem> };
    return (
        <KeyFace
            ref={ref}
            x={x} y={y} w={w} h={h} keycode={keycode} label={label} keyContents={keyContents}
            unitSize={drag.currentUnitSize} internationalLayout={internationalLayout}
            layerColor={layerColor} selected={selected} isRelative={isRelative} className={className}
            headerClassName={headerClassName} variant={variant} hoverBorderColor={hoverBorderColor}
            hoverBackgroundColor={hoverBackgroundColor} hoverLayerColor={hoverLayerColor}
            disableHover={disableHover} hasPendingChange={hasPendingChange} forceLabel={forceLabel}
            style={style} isDragHover={drag.isDragHover} isDragSource={drag.isDragSource}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onMouseEnter={drag.handleMouseEnter}
            onMouseLeave={drag.handleMouseLeave}
            onMouseDown={drag.handleMouseDown}
            onMouseUp={drag.handleMouseUp}
            title={disableTooltip ? undefined : (title || keycode)}
            {...faceRest}
        />
    );
});
Key.displayName = "Key";
