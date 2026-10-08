import { useState, type FC } from "react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useKeyboard } from "@/contexts/KeyboardContext";
import { keyboardService } from "@/services/keyboard.service";

/**
 * Shown once per connection when the board reports it reset its settings because
 * its storage could not be read. Acknowledging clears the board's flag.
 */
export const StorageResetDialog: FC = () => {
    const { keyboard, isConnected } = useKeyboard();
    const [acknowledged, setAcknowledged] = useState<string | null>(null);
    const open = Boolean(isConnected && keyboard?.storage_reset && acknowledged !== (keyboard.kbid ?? ""));

    const acknowledge = async () => {
        setAcknowledged(keyboard?.kbid ?? "");
        try {
            await keyboardService.clearStorageReset();
        } catch (error) {
            // The board keeps reporting the reset, so the next connection asks again.
            console.warn("Could not clear the storage reset notice", error);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(next) => !next && acknowledge()}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Your keyboard's settings were reset</DialogTitle>
                    <DialogDescription>
                        Your keyboard couldn't read its saved settings, so it started again from its defaults.
                        Load your layout file to restore your setup.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button onClick={acknowledge}>OK</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
