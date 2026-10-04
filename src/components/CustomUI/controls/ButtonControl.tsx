import { Button } from "@/components/ui/button";
import type { CustomUIMenuItem } from "@/types/vial.types";
import { cn } from "@/lib/utils";

interface ButtonControlProps {
    item: CustomUIMenuItem;
    onClick: () => void;
    compact?: boolean;
}

export const ButtonControl: React.FC<ButtonControlProps> = ({ item, onClick, compact = false }) => {
    return (
        <div className={cn(
            "flex flex-row items-center justify-between gap-2",
            compact ? "py-0.5" : "p-3 panel-layer-item"
        )}>
            <span className={compact ? "text-xs" : "text-md"}>{item.label}</span>
            <Button
                aria-label={item.label}
                aria-description={item.description}
                variant="outline"
                onClick={onClick}
                size={compact ? "sm" : "default"}
                className={compact ? "h-6 text-xs px-2" : ""}
            >
                Execute
            </Button>
        </div>
    );
};
