import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CustomUIMenuItem } from "@/types/vial.types";
import { cn } from "@/lib/utils";

interface DropdownControlProps {
    item: CustomUIMenuItem;
    value: number;
    onChange: (value: number) => void;
    compact?: boolean;
}

export const DropdownControl: React.FC<DropdownControlProps> = ({ item, value, onChange, compact = false }) => {
    // Options format: string[] of option labels (value is the index)
    const options = item.options as string[] | undefined;

    if (!options || options.length === 0) {
        return (
            <div className={cn(
                "flex flex-row items-center justify-between gap-2",
                compact ? "py-0.5" : "p-3 panel-layer-item"
            )}>
                <span title={item.description} className={compact ? "text-xs" : "text-md"}>{item.label}</span>
                <span className="text-muted-foreground text-xs">No options</span>
            </div>
        );
    }

    // Clamp value to valid range
    const safeValue = Math.max(0, Math.min(value, options.length - 1));

    return (
        <div className={cn(
            "flex flex-row items-center justify-between gap-2",
            compact ? "py-0.5" : "p-2 panel-layer-item"
        )}>
            <span title={item.description} className={compact ? "text-xs" : "text-md"}>{item.label}</span>
            <Select
                value={String(safeValue)}
                onValueChange={(val) => onChange(parseInt(val))}
            >
                <SelectTrigger aria-label={item.label} aria-description={item.description} className={compact ? "w-24 h-7 text-xs" : "w-40"}>
                    <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                    {options.map((option, index) => (
                        <SelectItem key={index} value={String(index)} className={compact ? "text-xs" : ""}>
                            {option}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
};
