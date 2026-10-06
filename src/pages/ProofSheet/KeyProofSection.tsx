/**
 * KeyProofSection - Collapsible section for a category of keys
 */

import type { FC } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import KeyProofRow from "./KeyProofRow";
import type { ProofCategory } from "./proof-data";
import { getProofKeyContents } from "./proof-data";

interface KeyProofSectionProps {
    category: ProofCategory;
    layerColor: string;
    selected: boolean;
    hasPendingChange: boolean;
    isExpanded: boolean;
    onToggle: () => void;
}

const KeyProofSection: FC<KeyProofSectionProps> = ({
    category,
    layerColor,
    selected,
    hasPendingChange,
    isExpanded,
    onToggle,
}) => {
    return (
        <div className="border border-gray-200 dark:border-neutral-700 rounded-lg overflow-hidden mb-3">
            {/* Header */}
            <button
                onClick={onToggle}
                className={cn(
                    "w-full flex flex-row items-center gap-3 px-4 py-3 text-left",
                    "bg-gray-50 hover:bg-gray-100 dark:bg-neutral-800/60 dark:hover:bg-neutral-800 transition-colors",
                    isExpanded && "border-b border-gray-200 dark:border-neutral-700"
                )}
            >
                {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-500 dark:text-neutral-400 shrink-0" />
                ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500 dark:text-neutral-400 shrink-0" />
                )}
                <div className="flex-1">
                    <span className="font-semibold text-gray-800 dark:text-neutral-100">{category.name}</span>
                    <span className="text-gray-400 dark:text-neutral-400 text-sm ml-2">({category.keys.length} keys)</span>
                </div>
                <span className="text-xs text-gray-400 dark:text-neutral-400">{category.description}</span>
            </button>

            {/* Content */}
            {isExpanded && (
                <div className="bg-kb-surface p-2">
                    {category.keys.map((key) => (
                        <KeyProofRow
                            key={key.keycode}
                            keycode={key.keycode}
                            description={key.description}
                            keyContents={getProofKeyContents(key.keycode)}
                            layerColor={layerColor}
                            selected={selected}
                            hasPendingChange={hasPendingChange}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default KeyProofSection;
