import React from "react";
import { KeyFace, type KeyProps } from "./KeyFace";
import { useKeyDrag } from "@/hooks/useKeyDrag";
export type { KeyProps } from "./KeyFace";

import { ReadOnlyKey } from "./ReadOnlyKey";

const InteractiveKey = React.forwardRef<HTMLDivElement, KeyProps>((props, ref) => {
    const uniqueId = React.useId();
    const interaction = useKeyDrag({ ...props, uniqueId, layerIndex: props.layerIndex ?? 0,
        layerColor: props.layerColor ?? "primary", isRelative: props.isRelative ?? false, variant: props.variant ?? "default" });
    return <KeyFace {...props} ref={ref} interaction={interaction} />;
});
InteractiveKey.displayName = "InteractiveKey";
export const Key = React.forwardRef<HTMLDivElement, KeyProps>((props, ref) =>
    props.disableDrag && props.disableHover ? <ReadOnlyKey {...props} ref={ref} /> : <InteractiveKey {...props} ref={ref} />
);
Key.displayName = "Key";
