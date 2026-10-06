import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import AudioKeys from "./AudioKeys";
import BacklightsKeys from "./BacklightsKeys";
import MediaKeys from "./MediaKeys";
import OtherKeys from "./OtherKeys";
import StenoKeys from "./StenoKeys";

interface Props {
    isPicker?: boolean;
}

const SpecialKeysPanel = ({ isPicker }: Props) => {
    const { layoutMode } = useLayoutSettings();
    const isHorizontal = layoutMode === "bottombar";

    if (isHorizontal) {
        return (
            <div className="flex flex-row gap-3 h-full items-start flex-wrap content-start">
                <OtherKeys variant="medium" />
                <MediaKeys variant="medium" />
                <AudioKeys variant="medium" />
                <BacklightsKeys variant="medium" />
                <StenoKeys variant="medium" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {isPicker && (
                <div className="pb-2">
                    <span className="font-semibold text-xl text-kb-ink">Special Keys</span>
                </div>
            )}
            <OtherKeys />
            <MediaKeys />
            <AudioKeys />
            <BacklightsKeys />
            <StenoKeys />
        </div>
    );
};

export default SpecialKeysPanel;
