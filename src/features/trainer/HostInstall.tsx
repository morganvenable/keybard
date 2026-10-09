import { Download, ExternalLink, PictureInPicture2, PlugZap } from 'lucide-react';
import { Notice } from '@/components/shared/Notice';
import { PILL_BRAND, PILL_QUIET } from '@/components/shared/pills';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { HostBuild } from './host';

// Keybard Host on the Overlay page (docs/practice/spec.md §5.14, §5.16): the status pill, the facts
// line, the outdated notice, and the wells shown in place of the Host card when Host isn't connected.
// The install steps that used to be paragraphs here live in the manual's Overlay chapter.

/** The Keybard Host release this Keybard offers; a connected host on another release is told about it. */
export const HOST_RELEASE_TAG = 'vLaunch2.2';
export const HOST_RELEASE = `https://github.com/svalboard/keybard/releases/tag/${HOST_RELEASE_TAG}`;
export const HOST_DOWNLOAD = HOST_RELEASE.replace('/tag/', '/download/') + '/KeybardHost-Windows.zip';
/** The local Keybard that Keybard Host serves. */
export const HOST_LOCAL_KEYBARD = 'http://127.0.0.1:5178/';
/** The manual's Overlay chapter, published beside the app (build/manual.ts). */
export const OVERLAY_MANUAL = `${import.meta.env.BASE_URL}manual/#overlay`;
export const CONNECT_TOOLTIP = 'If the browser asks to let this site access apps on your device, allow it';

/** "Keybard Host vLaunch2.2"; `dev` and hosts before vLaunch2 ('unknown') print as dev and (older). */
export function hostName(build: HostBuild | null): string {
    if (!build || build.version === 'unknown') return 'Keybard Host (older)';
    return `Keybard Host ${build.version}`;
}

export function hostOutdated(build: HostBuild | null): boolean {
    return !!build && build.version !== 'dev' && build.version !== HOST_RELEASE_TAG;
}

export type HostStatus = 'connected' | 'off' | 'lost';

/** The header's status pill: not interactive, `role="status"` (§5.14 Header). */
export function HostStatusPill({ status, build }: { status: HostStatus; build: HostBuild | null }) {
    const text = status === 'connected' ? hostName(build) : status === 'lost' ? 'Keybard Host connection lost' : 'Keybard Host not connected';
    return <span role="status" data-host-status={status} className="inline-flex items-center gap-2 text-sm font-medium pl-2 pr-5 py-1.5 rounded-full text-kb-ink whitespace-nowrap">
        <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full',
            status === 'connected' ? 'bg-kb-primary' : status === 'lost' ? 'bg-kb-red' : 'border-2 border-kb-gray-border')} />
        {text}
    </span>;
}

/** Which Keybard Host is connected, as one line of facts: "Keybard Host vLaunch2.2 · Keybard 5954334". */
export function HostVersion({ build }: { build: HostBuild | null }) {
    if (!build) return null;
    return <p className="w-full text-xs text-muted-foreground">{hostName(build)}{build.keybardCommit ? ` · Keybard ${build.keybardCommit}` : ''}</p>;
}

/** Points an older connected Host at the current release. */
export function HostOutdatedNotice({ build }: { build: HostBuild | null }) {
    if (!hostOutdated(build)) return null;
    return <Notice action={<a className={PILL_QUIET} href={HOST_RELEASE} target="_blank" rel="noreferrer"><Download />Download</a>}>
        Keybard Host {HOST_RELEASE_TAG} is available
    </Notice>;
}

const WELL = 'flex flex-col items-center gap-3.5 p-7 text-center rounded-md border-dashed border-1 border-gray-300 dark:border-neutral-600';
const LINK = 'inline-flex items-center gap-1 text-sm text-kb-ink underline underline-offset-2 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

/** In place of the Host card while Host isn't connected (web). `onConnect` is absent on a Host-served page. */
export function DesktopOverlayWell({ onConnect }: { onConnect?: () => void }) {
    return <section aria-labelledby="desktop-overlay-title" className={WELL}>
        <PictureInPicture2 aria-hidden="true" className="size-6 text-kb-ink" />
        <h2 id="desktop-overlay-title" className="text-lg font-semibold text-kb-ink">Desktop overlay</h2>
        <div className="flex flex-wrap justify-center gap-2">
            <a className={PILL_BRAND} href={HOST_DOWNLOAD}><Download />Download for Windows</a>
            {onConnect && <ConnectButton onConnect={onConnect} label="Connect to Keybard Host" icon />}
        </div>
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            <a className={LINK} href={HOST_LOCAL_KEYBARD} target="_blank" rel="noreferrer">Open local Keybard <ExternalLink aria-hidden="true" className="size-3.5" /></a>
            <a className={LINK} href={HOST_RELEASE} target="_blank" rel="noreferrer">Release notes <ExternalLink aria-hidden="true" className="size-3.5" /></a>
            <a className={LINK} href={OVERLAY_MANUAL} target="_blank" rel="noreferrer">Install steps <ExternalLink aria-hidden="true" className="size-3.5" /></a>
        </div>
    </section>;
}

/** Keybard Paranoid never contacts Host across origins, so it only names what to run. */
export function ParanoidWell() {
    return <section aria-labelledby="desktop-overlay-title" className={WELL}>
        <PictureInPicture2 aria-hidden="true" className="size-6 text-kb-ink" />
        <h2 id="desktop-overlay-title" className="text-lg font-semibold text-kb-ink">Start Keybard Host in paranoid mode</h2>
        <span className="font-mono text-[13px] px-2.5 py-1 rounded-full bg-kb-gray-medium text-kb-ink">Start-Paranoid.cmd</span>
    </section>;
}

/** A quiet pill that connects to Keybard Host, with the browser-permission tooltip. */
export function ConnectButton({ onConnect, label, icon = false }: { onConnect: () => void; label: string; icon?: boolean }) {
    return <Tooltip>
        <TooltipTrigger asChild>
            <button type="button" className={PILL_QUIET} onClick={onConnect}>{icon && <PlugZap />}{label}</button>
        </TooltipTrigger>
        <TooltipContent side="top">{CONNECT_TOOLTIP}</TooltipContent>
    </Tooltip>;
}
