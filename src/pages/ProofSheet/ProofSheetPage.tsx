/**
 * ProofSheetPage - Visual inspection page for key renderings
 *
 * Displays all key types at all sizes (default/medium/small) with various
 * state combinations (layer colors, selected, pending change) for QA purposes.
 */

import type { FC } from "react";
import { useState, useMemo } from "react";
import { ArrowLeft, Expand, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { layerColors } from "@/utils/colors";
import { proofCategories } from "./proof-data";
import KeyProofSection from "./KeyProofSection";

interface ProofSheetPageProps {
    onBack: () => void;
}

const ProofSheetPage: FC<ProofSheetPageProps> = ({ onBack }) => {
    // State
    const [selectedLayerColor, setSelectedLayerColor] = useState("green");
    const [showSelected, setShowSelected] = useState(false);
    const [showPending, setShowPending] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
        () => new Set(proofCategories.map((c) => c.name)) // Expand all by default
    );

    // Toggle category expansion
    const toggleCategory = (name: string) => {
        setExpandedCategories((prev) => {
            const next = new Set(prev);
            if (next.has(name)) {
                next.delete(name);
            } else {
                next.add(name);
            }
            return next;
        });
    };

    // Expand/collapse all
    const expandAll = () => {
        setExpandedCategories(new Set(proofCategories.map((c) => c.name)));
    };

    const collapseAll = () => {
        setExpandedCategories(new Set());
    };

    // Count total keys
    const totalKeys = useMemo(
        () => proofCategories.reduce((sum, cat) => sum + cat.keys.length, 0),
        []
    );

    return (
        <div className="h-full w-full bg-kb-surface flex flex-col">
            {/* Header */}
            <header className="border-b border-gray-200 dark:border-neutral-700 px-6 py-4 flex items-center gap-4 shrink-0">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onBack}
                    className="shrink-0"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-semibold text-slate-800 dark:text-neutral-100">Key Proof Sheet</h1>
                    <p className="text-sm text-gray-500 dark:text-neutral-400">
                        Visual inspection of key renderings at all sizes ({totalKeys} keys in{" "}
                        {proofCategories.length} categories)
                    </p>
                </div>
            </header>

            {/* Controls Bar */}
            <div className="border-b border-gray-200 dark:border-neutral-700 px-6 py-3 flex items-center gap-6 bg-gray-50 dark:bg-neutral-800/60 shrink-0 flex-wrap">
                {/* Layer Color Selector */}
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-neutral-200">Layer Color:</span>
                    <div className="flex gap-1">
                        {layerColors.map((color) => (
                            <button
                                key={color.name}
                                onClick={() => setSelectedLayerColor(color.name)}
                                className={cn(
                                    "w-6 h-6 rounded-full border-2 transition-all",
                                    selectedLayerColor === color.name
                                        ? "border-gray-800 dark:border-neutral-100 scale-110"
                                        : "border-transparent hover:scale-105"
                                )}
                                style={{ backgroundColor: color.hex }}
                                title={color.name}
                            />
                        ))}
                    </div>
                </div>

                {/* Divider */}
                <div className="h-6 w-px bg-gray-300 dark:bg-neutral-600" />

                {/* State Toggles */}
                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <Switch
                            checked={showSelected}
                            onCheckedChange={setShowSelected}
                        />
                        <span className="text-sm text-gray-700 dark:text-neutral-200">Selected</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                        <Switch
                            checked={showPending}
                            onCheckedChange={setShowPending}
                        />
                        <span className="text-sm text-gray-700 dark:text-neutral-200">Pending</span>
                    </label>
                </div>

                {/* Divider */}
                <div className="h-6 w-px bg-gray-300 dark:bg-neutral-600" />

                {/* Expand/Collapse Buttons */}
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={expandAll}
                        className="h-8"
                    >
                        <Expand className="w-4 h-4 mr-1" />
                        Expand All
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={collapseAll}
                        className="h-8"
                    >
                        <Minimize2 className="w-4 h-4 mr-1" />
                        Collapse All
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 overflow-auto p-6">
                {proofCategories.map((category) => (
                    <KeyProofSection
                        key={category.name}
                        category={category}
                        layerColor={selectedLayerColor}
                        selected={showSelected}
                        hasPendingChange={showPending}
                        isExpanded={expandedCategories.has(category.name)}
                        onToggle={() => toggleCategory(category.name)}
                    />
                ))}
            </main>
        </div>
    );
};

export default ProofSheetPage;
