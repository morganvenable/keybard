import React from "react";
import { KeyFace, type KeyProps } from "./KeyFace";
/** Display-only keys share their renderer without mounting editor binding or drag state. */
export const ReadOnlyKey = React.forwardRef<HTMLDivElement, KeyProps>((props, ref) => (
    <KeyFace {...props} ref={ref} interaction={{
        isDragSource: false, isDragHover: false,
        currentUnitSize: props.unitSize ?? (props.variant === "small" ? 30 : props.variant === "medium" ? 45 : 60),
        handleMouseEnter: () => {}, handleMouseLeave: () => {}, handleMouseDown: () => {}, handleMouseUp: () => {},
    }} />
));
ReadOnlyKey.displayName = "ReadOnlyKey";
