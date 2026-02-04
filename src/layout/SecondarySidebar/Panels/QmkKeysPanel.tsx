import { getKeyContents } from "@/utils/keys";
import { useKeyBinding } from "@/contexts/KeyBindingContext";
import { useLayer } from "@/contexts/LayerContext";
import { useLayoutSettings } from "@/contexts/LayoutSettingsContext";
import { useVial } from "@/contexts/VialContext";
import { hoverBackgroundClasses, hoverBorderClasses, hoverHeaderClasses } from "@/utils/colors";
import { Key } from "@/components/Key";

interface Props {
    isPicker?: boolean;
}

const QmkKeyPanel = ({ isPicker }: Props) => {
    const { assignKeycode } = useKeyBinding();
    const { keyboard } = useVial();
    const { selectedLayer } = useLayer();
    const { keyVariant, layoutMode } = useLayoutSettings();

    const isHorizontal = layoutMode === "bottombar";

    const layerColorName = keyboard?.cosmetic?.layer_colors?.[selectedLayer] || "primary";
    const hoverBorderColor = hoverBorderClasses[layerColorName] || hoverBorderClasses["primary"];
    const hoverBackgroundColor = hoverBackgroundClasses[layerColorName] || hoverBackgroundClasses["primary"];
    const hoverHeaderClass = hoverHeaderClasses[layerColorName] || hoverHeaderClasses["primary"];

    const handleKeyClick = (keycode: string) => {
        assignKeycode(keycode);
    };

    const keySizeClass = keyVariant === 'small' ? 'h-[30px] w-[30px]' : keyVariant === 'medium' ? 'h-[45px] w-[45px]' : 'h-[60px] w-[60px]';

    const renderKey = (keycode: string, label: string, small?: boolean) => {
        const keyContents = getKeyContents(keyboard!, keycode);

        return (
            <Key
                key={keycode}
                x={0} y={0} w={1} h={1} row={0} col={0}
                keycode={keycode}
                label={label}
                keyContents={keyContents}
                layerColor="sidebar"
                headerClassName={`bg-kb-sidebar-dark ${hoverHeaderClass}`}
                isRelative
                variant={small ? "small" : keyVariant}
                className={small ? "h-[30px] w-[30px]" : keySizeClass}
                onClick={() => handleKeyClick(keycode)}
                hoverBorderColor={hoverBorderColor}
                hoverBackgroundColor={hoverBackgroundColor}
                hoverLayerColor={layerColorName}
                disableTooltip={true}
            />
        );
    };

    // Horizontal layout for bottom panel
    if (isHorizontal) {
        const osmLeftKeys = [
            { kc: "OSM(MOD_LSFT)", label: "⇧" }, { kc: "OSM(MOD_LCTL)", label: "⌃" },
            { kc: "OSM(MOD_LALT)", label: "⌥" }, { kc: "OSM(MOD_LGUI)", label: "⌘" },
            { kc: "OSM(MOD_MEH)", label: "Meh" }, { kc: "OSM(MOD_HYPR)", label: "Hyp" },
        ];
        const osmRightKeys = [
            { kc: "OSM(MOD_RSFT)", label: "R⇧" }, { kc: "OSM(MOD_RCTL)", label: "R⌃" },
            { kc: "OSM(MOD_RALT)", label: "R⌥" }, { kc: "OSM(MOD_RGUI)", label: "R⌘" },
        ];

        const renderGroup = (keys: { kc: string; label: string }[], label: string) => (
            <div className="flex flex-col gap-1">
                <span className="text-[9px] font-bold text-slate-500 uppercase">{label}</span>
                <div className="flex flex-row gap-1 flex-wrap">
                    {keys.map((k) => renderKey(k.kc, k.label, true))}
                </div>
            </div>
        );

        return (
            <div className="flex flex-row gap-3 h-full items-start flex-wrap content-start">
                {renderGroup(osmLeftKeys, "OSM Left")}
                {renderGroup(osmRightKeys, "OSM Right")}
            </div>
        );
    }

    return (
        <div className="space-y-6 pt-3 pb-8">
            {isPicker && (
                <div className="pb-2">
                    <span className="font-semibold text-xl text-slate-700">One-Shot</span>
                </div>
            )}
            {/* One-Shot Modifiers Section */}
            <section className="flex flex-col gap-3">
                <span className="font-semibold text-lg text-slate-700">One-Shot Modifiers</span>

                <div className="flex flex-col gap-2">
                    <span className="text-base font-medium text-black">Left Hand Side</span>
                    <div className="flex flex-wrap gap-2">
                        {renderKey("OSM(MOD_LSFT)", "OSM LSft")}
                        {renderKey("OSM(MOD_LCTL)", "OSM LCtl")}
                        {renderKey("OSM(MOD_LALT)", "OSM LAlt")}
                        {renderKey("OSM(MOD_LGUI)", "OSM LGUI")}
                        {renderKey("OSM(MOD_LCTL|MOD_LSFT)", "OSM CS")}
                        {renderKey("OSM(MOD_LCTL|MOD_LALT)", "OSM CA")}
                        {renderKey("OSM(MOD_LCTL|MOD_LGUI)", "OSM CG")}
                        {renderKey("OSM(MOD_LSFT|MOD_LALT)", "OSM SA")}
                        {renderKey("OSM(MOD_LSFT|MOD_LGUI)", "OSM SG")}
                        {renderKey("OSM(MOD_LALT|MOD_LGUI)", "OSM AG")}
                        {renderKey("OSM(MOD_LCTL|MOD_LSFT|MOD_LGUI)", "OSM CSG")}
                        {renderKey("OSM(MOD_LCTL|MOD_LALT|MOD_LGUI)", "OSM CAG")}
                        {renderKey("OSM(MOD_LSFT|MOD_LALT|MOD_LGUI)", "OSM SAG")}
                        {renderKey("OSM(MOD_MEH)", "OSM Meh")}
                        {renderKey("OSM(MOD_HYPR)", "OSM Hyper")}
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <span className="text-base font-medium text-black">Right Hand Side</span>
                    <div className="flex flex-wrap gap-2">
                        {renderKey("OSM(MOD_RSFT)", "OSM RSft")}
                        {renderKey("OSM(MOD_RCTL)", "OSM RCtl")}
                        {renderKey("OSM(MOD_RALT)", "OSM RAlt")}
                        {renderKey("OSM(MOD_RGUI)", "OSM RGUI")}
                        {renderKey("OSM(MOD_RCTL|MOD_RSFT)", "OSM RCS")}
                        {renderKey("OSM(MOD_RCTL|MOD_RALT)", "OSM RCA")}
                        {renderKey("OSM(MOD_RCTL|MOD_RGUI)", "OSM RCG")}
                        {renderKey("OSM(MOD_RSFT|MOD_RALT)", "OSM RSA")}
                        {renderKey("OSM(MOD_RSFT|MOD_RGUI)", "OSM RSG")}
                        {renderKey("OSM(MOD_RALT|MOD_RGUI)", "OSM RAG")}
                        {renderKey("OSM(MOD_RCTL|MOD_RSFT|MOD_RGUI)", "OSM RCSG")}
                        {renderKey("OSM(MOD_RCTL|MOD_RALT|MOD_RGUI)", "OSM RCAG")}
                        {renderKey("OSM(MOD_RSFT|MOD_RALT|MOD_RGUI)", "OSM RSAG")}
                        {renderKey("OSM(MOD_RCTL|MOD_RSFT|MOD_RALT)", "OSM RMeh")}
                        {renderKey("OSM(MOD_RCTL|MOD_RSFT|MOD_RALT|MOD_RGUI)", "OSM RHyp")}
                    </div>
                </div>
            </section>

        </div>
    );
};

export default QmkKeyPanel;
