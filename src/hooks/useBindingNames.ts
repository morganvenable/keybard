import { useState } from "react";
import { useVial } from "@/contexts/VialContext";
import { useChanges } from "@/contexts/ChangesContext";
import { LabelService } from "@/services/label.service";
import { usbInstance } from "@/services/usb.service";

const labels = new LabelService(usbInstance);

export function useBindingNames() {
    const { keyboard, setKeyboard, isConnected } = useVial();
    const { queue } = useChanges();
    const [nameError, setNameError] = useState<string | null>(null);
    const renameBinding = async (kind: "macro" | "tapdance", index: number, value: string) => {
        if (!keyboard) return false;
        const name = value.trim();
        setNameError(null);
        try {
            if (isConnected) labels.validateName(keyboard, kind, name);
            const key = kind === "macro" ? "macros" : "tapdances";
            setKeyboard(current => {
                if (!current) return current;
                const names = { ...current.cosmetic?.[key] };
                if (name) names[String(index)] = name;
                else delete names[String(index)];
                return { ...current, cosmetic: { ...current.cosmetic, [key]: names } };
            });
            if (isConnected) await queue(`${kind} ${index} name`, async () => {
                await labels.saveName(keyboard, kind, index, name);
            }, { type: "label", writeKey: `label:${kind}:${index}` });
            return true;
        } catch (error) {
            setNameError(error instanceof Error ? error.message : "Could not save name.");
            return false;
        }
    };
    return { renameBinding, nameError };
}
