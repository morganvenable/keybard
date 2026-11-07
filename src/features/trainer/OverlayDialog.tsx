import { useEffect, useRef } from 'react';
import { Download, PlugZap, Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLayoutSettings } from '@/contexts/LayoutSettingsContext';
import { PARANOID } from '@/lib/paranoid';
import { DEFAULT_SHIFTED_LEGENDS } from '@/lib/shiftedLegends';
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
    // Mounted only while open, so Keybard talks to the overlay app only then.
    const host = useHost();
    const { internationalLayout, showShiftedLegends, showAltGrLegends } = useLayoutSettings();
    // The overlay draws what Keybard's Settings say: the keyboard language, Shifted Key Symbols and AltGr Symbols.
    const shiftedLegends = showShiftedLegends ?? DEFAULT_SHIFTED_LEGENDS, altgrLegends = showAltGrLegends === true;
    // One sync for everything Keybard sends: the keyboard language, Shifted Key Symbols and AltGr Symbols. They share
    // one write, because two writes started in the same render race: the second finds the first still in flight and
    // is dropped, which once left AltGr Symbols unsent. An older overlay app has neither legend field and rejects
    // unknown ones, so only fields it reports are sent. A write that did not start (busy) is tried again when the
    // busy flag clears; one that started and failed is not repeated for the same values on this connection.
    const tried = useRef('');
    useEffect(() => {
        const config = host.state?.config;
        if (!config || host.busy) return;
        const fields: Partial<Record<'layoutId' | 'shiftedLegends' | 'altgrLegends', string | boolean>> = {};
        if (config.layoutId !== internationalLayout) fields.layoutId = internationalLayout;
        if ('shiftedLegends' in config && config.shiftedLegends !== shiftedLegends) fields.shiftedLegends = shiftedLegends;
        if ('altgrLegends' in config && config.altgrLegends !== altgrLegends) fields.altgrLegends = altgrLegends;
        if (!Object.keys(fields).length) { tried.current = ''; return; }
        const attempt = `${host.state?.session}:${host.state?.revision}:${JSON.stringify(fields)}`;
        if (tried.current === attempt) return;
        void Promise.resolve(host.configure(latest => ({ ...latest, ...fields }))).then(started => { if (started !== null) tried.current = attempt; });
    }, [internationalLayout, shiftedLegends, altgrLegends, host.state?.session, host.state?.config, host.busy]);
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
