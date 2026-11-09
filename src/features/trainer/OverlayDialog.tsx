import { Download, PlugZap, Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PARANOID } from '@/lib/paranoid';
import { useHost } from './host';
import { HOST_DOWNLOAD, HostVersion } from './HostInstall';

/** Links that open the overlay dialog: the overlay app's Open Keybard, and older versions' #trainer. */
export const overlayRequested = (hash = window.location.hash) => hash === '#overlay' || hash === '#trainer';

/**
 * The desktop overlay is the Keybard Overlay app, which reads the board and keeps its own settings.
 * Keybard only offers the download and connects to it, so the overlay refreshes after edits
 * and uses Keybard's keyboard language.
 */
export function OverlayDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    return <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[440px]">{open && <OverlayDialogBody />}</DialogContent>
    </Dialog>;
}

function OverlayDialogBody() {
    const host = useHost();
    // Keybard's language, Shifted Key Symbols and AltGr Symbols reach the overlay from HostSettingsSync, dialog open or not.
    const board = host.state?.devices.find(d => d.id === host.state?.selectedDevice);
    const description = host.state
        ? board ? `The overlay app is following ${board.name}.` : 'The overlay app is running. Choose a board from its menu.'
        : PARANOID ? 'Start the Keybard Overlay app in paranoid mode (Start-Paranoid.cmd) and use the Keybard it opens.'
            : 'The Keybard Overlay app shows your layout above your other windows.';
    return <>
        <DialogHeader>
            <DialogTitle>Desktop overlay</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {host.error && !host.state && <p role="alert" className="text-sm text-destructive">{host.error}</p>}
        {host.state?.modifiersFromBoard === false && <p role="status" className="text-sm text-muted-foreground">
            This board's firmware is older than x4.5, so it can't tell the overlay when Shift or AltGr is held. The overlay asks your computer instead, which doesn't work on Wayland. Install x4.5 in Firmware.
        </p>}
        <HostVersion build={host.build} />
        <DialogFooter>
            {host.state ? board && <Button variant="outline" onClick={() => void host.command({ op: 'disconnect' })}><Unplug /> Disconnect</Button>
            : !PARANOID && <>
                {!host.local && <Button variant="outline" onClick={host.connect}><PlugZap /> Connect</Button>}
                <Button asChild><a href={HOST_DOWNLOAD}><Download /> Download for Windows</a></Button>
            </>}
        </DialogFooter>
    </>;
}
