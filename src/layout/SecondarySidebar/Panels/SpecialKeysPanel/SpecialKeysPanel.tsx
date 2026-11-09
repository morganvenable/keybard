import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import {
    EDITING_KEYS,
    FEATURE_SWITCH_KEYS,
    LIGHTING_KEYS,
    LIGHTING_NOTE,
    MEDIA_KEYS,
} from "@/constants/special-key-groups";
import InternationalKeys from "./InternationalKeys";
import MoreKeys from "./MoreKeys";
import OtherKeys from "./OtherKeys";
import SpecialKeyGroup from "./SpecialKeyGroup";
import StenoKeys from "./StenoKeys";
import SvalboardKeys from "./SvalboardKeys";

interface Props {
    isPicker?: boolean;
}

const SpecialKeysPanel = ({ isPicker }: Props) => {
    const { layoutMode } = useLayoutSettings();
    const isHorizontal = layoutMode === "bottombar";
    const variant = isHorizontal ? "medium" : undefined;

    const groups = (
        <>
            <OtherKeys variant={variant} />
            <SvalboardKeys variant={variant} />
            <SpecialKeyGroup title="Editing" keys={EDITING_KEYS} variant={variant} sort={false} />
            <SpecialKeyGroup title="Media" keys={MEDIA_KEYS} variant={variant} />
            <SpecialKeyGroup title="Lighting" note={isHorizontal ? undefined : LIGHTING_NOTE} keys={LIGHTING_KEYS} variant={variant} sort={false} />
            <SpecialKeyGroup title="Feature switches" keys={FEATURE_SWITCH_KEYS} variant={variant} sort={false} />
            <StenoKeys variant={variant} />
            <InternationalKeys variant={variant} />
            <MoreKeys variant={variant} />
        </>
    );

    if (isHorizontal) {
        return <div className="flex flex-row gap-3 h-full items-start flex-wrap content-start">{groups}</div>;
    }

    return (
        <div className="flex flex-col gap-4">
            {isPicker && (
                <div className="pb-2">
                    <span className="font-semibold text-xl text-kb-ink">Special Keys</span>
                </div>
            )}
            {groups}
        </div>
    );
};

export default SpecialKeysPanel;
