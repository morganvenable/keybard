import React from "react";
import { InfoIcon } from "@/components/icons/InfoIcon";
import { cn } from "@/lib/utils";
import { useKeyBinding } from "@/contexts/KeyBindingContext";
import { useKeyboard } from "@/contexts/KeyboardContext";
import { keyService } from "@/services/key.service";
import { MATRIX_COLS } from "@/constants/svalboard-layout";

interface InfoPanelWidgetProps {
    showInfoPanel: boolean;
    setShowInfoPanel: (show: boolean) => void;
}

export const InfoPanelWidget: React.FC<InfoPanelWidgetProps> = ({ showInfoPanel, setShowInfoPanel }) => {
    return (
        <div className="relative w-12 h-12">
            {/* Expanding panel - grows to the right from behind the icon */}
            <div
                className={cn(
                    "absolute bottom-0 left-0 bg-kb-surface text-kb-ink shadow-lg transition-all duration-300 ease-in-out overflow-hidden",
                    showInfoPanel
                        ? "w-[350px] h-12 rounded-xl"
                        : "w-12 h-12 rounded-xl border border-gray-200 dark:border-neutral-700"
                )}
                onClick={() => !showInfoPanel && setShowInfoPanel(true)}
            >
                {/* Content area - only visible when open */}
                <div className={cn(
                    "absolute top-0 left-12 right-0 bottom-0 flex items-center px-3 overflow-hidden transition-opacity duration-200",
                    showInfoPanel ? "opacity-100 delay-100" : "opacity-0 pointer-events-none"
                )}>
                    {(() => {
                        const { hoveredKey, selectedTarget } = useKeyBinding();
                        const { keyboard } = useKeyboard();

                        // Priority: hoveredKey with keycode > selectedTarget
                        // For selectedTarget keyboard keys, we need to look up the keycode from keyboard data
                        let keycodeName: string | null = null;

                        if (hoveredKey?.keycode) {
                            // Hovered key has keycode directly
                            keycodeName = String(hoveredKey.keycode);
                        } else if (selectedTarget?.type === "keyboard" && keyboard?.keymap) {
                            // Selected keyboard key - look up keycode from keymap
                            const { layer, row, col } = selectedTarget;
                            if (layer !== undefined && row !== undefined && col !== undefined) {
                                const matrixCols = keyboard.cols || MATRIX_COLS;
                                const pos = row * matrixCols + col;
                                const keycode = keyboard.keymap[layer]?.[pos];
                                if (keycode !== undefined && keycode !== null) {
                                    // Convert numeric keycode to string name
                                    keycodeName = typeof keycode === "string"
                                        ? keycode
                                        : keyService.stringify(keycode);
                                }
                            }
                        }

                        if (!keycodeName) {
                            return (
                                <p className="text-gray-300 dark:text-neutral-400 italic text-sm select-none">No key selected</p>
                            );
                        }

                        return (
                            <div className="flex items-center gap-2 select-none min-w-0">
                                <span className="font-bold text-gray-500 dark:text-neutral-400 text-[10px] uppercase tracking-wider shrink-0">Keycode:</span>
                                <span className="font-mono bg-gray-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-xs truncate">{keycodeName}</span>
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* Icon button - positioned on top, stays fixed in place */}
            <button
                className={cn(
                    "absolute bottom-0 left-0 w-12 h-12 flex items-center justify-center transition-colors z-10",
                    showInfoPanel
                        ? "text-kb-ink hover:text-gray-600 dark:hover:text-neutral-300"
                        : "text-kb-ink hover:text-gray-500 dark:hover:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 rounded-xl"
                )}
                onClick={(e) => {
                    e.stopPropagation();
                    setShowInfoPanel(!showInfoPanel);
                }}
                title={showInfoPanel ? "Close Info" : "Show Key Info"}
            >
                <InfoIcon className="h-5 w-5" />
            </button>
        </div>
    );
};
