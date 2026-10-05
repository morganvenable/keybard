import { useLayerNames } from "@/hooks/useLayerNames";
import { DialogClose, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { FC, useState, useEffect, useRef } from "react";

import { useVial } from "@/contexts/VialContext";
import { layerColors } from "@/utils/colors";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { svalService } from "@/services/sval.service";

interface Props {
    layer: number;
}

const EditLayer: FC<Props> = ({ layer }) => {
    const { renameLayer, nameError } = useLayerNames();
    const closeRef = useRef<HTMLButtonElement>(null);
    const { keyboard, setKeyboard } = useVial();
    const currentName = keyboard ? svalService.getLayerName(keyboard, layer) : "";
    const currentColor = keyboard?.cosmetic?.layer_colors?.[layer.toString()] || "green";

    const [selectedColor, setSelectedColor] = useState<string | null>(currentColor);
    const [name, setName] = useState<string>(currentName);

    // Sync state when currentName or currentColor changes (if the modal stays mounted)
    useEffect(() => {
        setName(currentName);
    }, [currentName]);

    useEffect(() => {
        setSelectedColor(currentColor);
    }, [currentColor]);
    const handleSubmit = async () => {
        if (!await renameLayer(layer, name)) return;
        if (selectedColor) {
            setKeyboard(current => current ? {
                ...current,
                cosmetic: {
                    ...current.cosmetic,
                    layer_colors: { ...current.cosmetic?.layer_colors, [layer.toString()]: selectedColor },
                },
            } : current);
        }
        closeRef.current?.click();
    };
    return (
        <DialogContent>
            <DialogHeader></DialogHeader>
            {nameError && <p role="alert" className="text-red-600">{nameError}</p>}
            <div className="grid gap-4">
                <Label htmlFor="name-1">Layer {layer} Name</Label>
                <Input id="name-1" name="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-3 mt-4">
                <Label htmlFor="color-1">Layer Color</Label>
                <div className="flex flex-row gap-2">
                    {layerColors.map((color) => (
                        <div
                            key={color.name}
                            className={`w-10 h-10 rounded-full cursor-pointer hover:opacity-90 ${selectedColor === color.name ? "border-black border-2 shadow-md" : "border-transparent"
                                }`}
                            style={{ backgroundColor: color.hex }}
                            onClick={() => setSelectedColor(color.name)}
                        ></div>
                    ))}
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button ref={closeRef} variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={() => void handleSubmit()}>Save</Button>
            </DialogFooter>
        </DialogContent>
    );
};

export default EditLayer;
