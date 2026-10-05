import { cn } from "@/lib/utils";
import { FC } from "react";

interface Props {
    value: boolean;
    onToggle: (newValue: boolean) => void;
    className?: string;
    label?: string;
    description?: string;
}

const OnOffToggle: FC<Props> = ({ value, onToggle, className, label, description }) => {
    return (
        <div
            role="group"
            aria-label={label}
            aria-description={description}
            className={cn("flex flex-row items-center bg-gray-100 dark:bg-gray-800 rounded-full p-0.5 w-fit border border-gray-200 dark:border-gray-700", className)}
            onClick={(e) => e.stopPropagation()}
        >
            <button
                type="button"
                aria-pressed={value}
                onClick={(e) => {
                    e.stopPropagation();
                    if (!value) onToggle(true);
                }}
                className={cn(
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 px-3 py-1 text-[10px] uppercase tracking-wide rounded-full transition-all font-bold",
                    value
                        ? "bg-black text-white shadow-sm"
                        : "text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white"
                )}
            >
                ON
            </button>
            <button
                type="button"
                aria-pressed={!value}
                onClick={(e) => {
                    e.stopPropagation();
                    if (value) onToggle(false);
                }}
                className={cn(
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 px-3 py-1 text-[10px] uppercase tracking-wide rounded-full transition-all font-bold",
                    !value
                        ? "bg-black text-white shadow-sm"
                        : "text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white"
                )}
            >
                OFF
            </button>
        </div>
    );
};

export default OnOffToggle;
