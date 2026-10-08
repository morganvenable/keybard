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
 * Shown once per connection when the board reports a storage problem:
 * - it can't save changes right now, so they'll be lost when it restarts;
 * - it reset its settings because its storage could not be read. Acknowledging
 *   clears the board's flag.
 * If both apply, the warning about unsaved changes comes first.
 */
export const StorageResetDialog: FC = () => {
    const { keyboard, isConnected } = useKeyboard();
    const [acknowledgedReset, setAcknowledgedReset] = useState<string | null>(null);
    const [acknowledgedWriteFailure, setAcknowledgedWriteFailure] = useState<string | null>(null);
    const kbid = keyboard?.kbid ?? "";
    const showWriteFailure = Boolean(isConnected && keyboard?.storage_write_failed && acknowledgedWriteFailure !== kbid);
    const showReset = Boolean(isConnected && keyboard?.storage_reset && acknowledgedReset !== kbid && !showWriteFailure);

    const acknowledgeReset = async () => {
        setAcknowledgedReset(kbid);
        try {
            await keyboardService.clearStorageReset();
        } catch (error) {
            // The board keeps reporting the reset, so the next connection asks again.
            console.warn("Could not clear the storage reset notice", error);
        }
    };

    // The board clears this itself when it restarts, so there's nothing to send.
    const acknowledgeWriteFailure = () => setAcknowledgedWriteFailure(kbid);

    if (showWriteFailure) {
        return (
            <Dialog open onOpenChange={(next) => !next && acknowledgeWriteFailure()}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle>Your keyboard can't save changes</DialogTitle>
                        <DialogDescription>
                            Your keyboard couldn't save its settings since it was plugged in. Changes you make will
                            show up, but they'll be lost when it restarts. Unplug it and plug it back in, then make
                            your changes again.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button onClick={acknowledgeWriteFailure}>OK</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={showReset} onOpenChange={(next) => !next && acknowledgeReset()}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Your keyboard's settings were reset</DialogTitle>
                    <DialogDescription>
                        Your keyboard couldn't read its saved settings, so it started again from its defaults.
                        Load your layout file to restore your setup.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button onClick={acknowledgeReset}>OK</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
