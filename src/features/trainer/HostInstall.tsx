import { Download, ExternalLink, PlugZap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const HOST_RELEASE = 'https://github.com/svalboard/keybard/releases/tag/keybard-host-v0.1.0-preview.1';
export const HOST_DOWNLOAD = HOST_RELEASE.replace('/tag/', '/download/') + '/KeybardHost-Windows.zip';

export function HostInstall({ onConnect }: { onConnect?: () => void }) {
    return <section className="trainer-install" aria-label="Install desktop overlay">
        <div className="trainer-install-heading"><div><h2>Use Trainer on your desktop</h2>
            <p>Install Keybard Host to show the overlay above your other apps.</p></div>
            <a className="trainer-install-download" href={HOST_DOWNLOAD}><Download size={16} /> Download for Windows</a>
        </div>
        <p>Extract the ZIP, then run <strong>Start-Windows.cmd</strong>. First launch needs internet to install its local runtime. No administrator access needed.</p>
        <p>The app opens Keybard in your browser. Connect your board, then select <strong>Trainer</strong>. The overlay stays running in the system tray.</p>
        {onConnect && <p>Is Keybard Host running? Connect this page to it. If your browser asks to let this site access apps on your device, allow it.</p>}
        <div className="trainer-install-links">{onConnect && <Button variant="outline" onClick={onConnect}><PlugZap size={14} /> Connect to Keybard Host</Button>}<a href="http://127.0.0.1:5178/" target="_blank" rel="noreferrer">Already running? Open local Keybard <ExternalLink size={12} /></a>
            <a href={HOST_RELEASE} target="_blank" rel="noreferrer">Release notes</a></div>
    </section>;
}
