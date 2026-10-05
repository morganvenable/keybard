import { useState } from "react";
import { useVial } from "@/contexts/VialContext";
import { useChanges } from "@/contexts/ChangesContext";
import { LabelService } from "@/services/label.service";
import { usbInstance } from "@/services/usb.service";

const labels = new LabelService(usbInstance);

export function useLayerNames() {
    const { keyboard, setKeyboard, isConnected } = useVial();
    const { queue } = useChanges();
    const [nameError, setNameError] = useState<string | null>(null);
    const renameLayer = async (index: number, value: string): Promise<boolean> => {
        if (!keyboard) return false;
        const name = value.trim();
        setNameError(null);
        try {
            if (isConnected) labels.validateLayerName(keyboard, name);
            setKeyboard(current => {
                if (!current) return current;
                const layer = { ...current.cosmetic?.layer };
                if (name) layer[index.toString()] = name;
                else delete layer[index.toString()];
                return { ...current, cosmetic: { ...current.cosmetic, layer } };
            });
            if (isConnected) {
                await queue(`Layer ${index} name`, async () => {
                    try {
                        await labels.saveLayerName(keyboard, index, name);
                    } catch (error) {
                        setNameError(error instanceof Error ? error.message : "Could not save layer name.");
                        throw error;
                    }
                }, { type: "label", layer: index, writeKey: `label:layer:${index}` });
            }
            return true;
        } catch (error) {
            setNameError(error instanceof Error ? error.message : "Could not save layer name.");
            return false;
        }
    };
    return { renameLayer, nameError };
}
