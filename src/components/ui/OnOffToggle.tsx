import { cn } from "@/lib/utils";
import { FC } from "react";

interface Props {
    value: boolean;
    onToggle: (newValue: boolean) => void;
    className?: string;
}

const OnOffToggle: FC<Props> = ({ value, onToggle, className }) => {
    return (
        <div
            className={cn("flex flex-row items-center bg-gray-100 dark:bg-gray-800 rounded-full p-0.5 w-fit border border-gray-200 dark:border-gray-700", className)}
            onClick={(e) => e.stopPropagation()}
        >
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    if (!value) onToggle(true);
                }}
                className={cn(
                    "px-3 py-1 text-[10px] uppercase tracking-wide rounded-full transition-all font-bold",
                    value
                        ? "bg-black text-white shadow-sm"
                        : "text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white"
                )}
            >
                ON
            </button>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    if (value) onToggle(false);
                }}
                className={cn(
                    "px-3 py-1 text-[10px] uppercase tracking-wide rounded-full transition-all font-bold",
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
