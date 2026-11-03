import type { CustomUIMenuItem } from "@/types/keyboard.types";
import { ToggleControl } from "./ToggleControl";
import { RangeControl } from "./RangeControl";
import { DropdownControl } from "./DropdownControl";
import { ButtonControl } from "./ButtonControl";
import { ScanRateControl } from "./ScanRateControl";
import { evaluateCondition } from "@/utils/show-if-evaluator";

interface CustomUIControlProps {
    item: CustomUIMenuItem;
    values: Map<string, number>;
    onValueChange: (key: string, value: number) => void;
    onButtonClick?: (key: string) => void;
    /** When true, renders in compact size for bottom panel */
    compact?: boolean;
}

/**
 * Dispatcher component that renders the appropriate control based on item type
 */
export const CustomUIControl: React.FC<CustomUIControlProps> = ({
    item,
    values,
    onValueChange,
    onButtonClick,
    compact = false,
}) => {
    // Extract value key from content array
    const content = item.content as (string | number)[] | undefined;
    if (!content || !Array.isArray(content) || typeof content[0] !== 'string') {
        console.warn("Invalid control content:", item);
        return null;
    }

    const valueKey = content[0] as string;
    // Undefined: the value wasn't read from the board. The control says so and never
    // shows a stand-in such as 0 or Off; choosing a value still writes it.
    const currentValue = values.get(valueKey);
    // A disabledIf whose value wasn't read doesn't disable it: its own value can still be written.
    const disabled = item.disabledIf ? evaluateCondition(item.disabledIf, values) ?? false : false;

    const handleChange = (value: number) => {
        onValueChange(valueKey, value);
    };

    const handleButtonClick = () => {
        onButtonClick?.(valueKey);
    };

    switch (item.type) {
        case 'toggle':
            return (
                <ToggleControl
                    item={item}
                    value={currentValue}
                    onChange={handleChange}
                    compact={compact}
                />
            );

        case 'range':
            if (valueKey === 'id_scan_period_us') {
                return <ScanRateControl item={item} value={currentValue} onChange={handleChange} compact={compact} />;
            }
            return (
                <RangeControl
                    item={item}
                    value={currentValue}
                    onChange={handleChange}
                    compact={compact}
                    disabled={disabled}
                />
            );

        case 'dropdown':
            return (
                <DropdownControl
                    item={item}
                    value={currentValue}
                    onChange={handleChange}
                    compact={compact}
                />
            );

        case 'button':
            return (
                <ButtonControl
                    item={item}
                    onClick={handleButtonClick}
                    compact={compact}
                />
            );

        case 'link':
            // App-provided: opens another view (onButtonClick gets the action), writes nothing.
            return (
                <div className={compact ? "py-0.5" : "px-3 py-2 panel-layer-item"}>
                    <button
                        type="button"
                        onClick={handleButtonClick}
                        className={(compact ? "text-xs " : "text-sm ") + "font-medium text-kb-ink underline underline-offset-2 hover:text-kb-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"}
                    >
                        {item.label}
                    </button>
                </div>
            );

        case 'color':
            // TODO: Implement color picker control
            return (
                <div className="flex flex-row items-center justify-between p-3 gap-3 panel-layer-item">
                    <span className="text-md">{item.label}</span>
                    <span className="text-muted-foreground text-sm">Color picker not yet implemented</span>
                </div>
            );

        case 'keycode':
            // TODO: Implement keycode picker control (integrate with KeyBindingContext)
            return (
                <div className="flex flex-row items-center justify-between p-3 gap-3 panel-layer-item">
                    <span className="text-md">{item.label}</span>
                    <span className="text-muted-foreground text-sm">Keycode picker not yet implemented</span>
                </div>
            );

        default:
            console.warn(`Unknown control type: ${item.type}`);
            return (
                <div className="flex flex-row items-center justify-between p-3 gap-3 panel-layer-item">
                    <span className="text-md">{item.label}</span>
                    <span className="text-muted-foreground text-sm">Unknown control type: {item.type}</span>
                </div>
            );
    }
};
