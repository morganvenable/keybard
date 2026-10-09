import { useRef } from 'react';
import { House, RotateCw, Unplug, Upload } from 'lucide-react';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Notice } from '@/components/shared/Notice';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PARANOID } from '@/lib/paranoid';
import { cn } from '@/lib/utils';
import { ConnectButton, DesktopOverlayWell, HostOutdatedNotice, HostStatusPill, HostVersion, ParanoidWell, hostOutdated, type HostStatus } from './HostInstall';
import { OverlaySurface } from './OverlaySurface';
import { useOverlay } from './OverlayProvider';
import { PREVIEW_BACKGROUNDS, PREVIEW_BACKGROUND_NAMES, type PreviewBackground } from './preview-backgrounds';
import type { LayoutSource, OverlayModel } from './useOverlayController';

// O1 Overlay page (docs/practice/spec.md §5.14, §5.16): the Host connection, a preview of the overlay
// over a desktop stand-in, and the layout and layers it previews. Settings are in the Overlay panel
// (OverlayPanel). Only the chrome around the overlay surface is Keybard's; the surface keeps the user's
// appearance colors.

const CARD = 'bg-kb-surface rounded-2xl border border-gray-200 dark:border-neutral-700';
const ROW_TITLE = 'text-[15px] text-kb-ink';

export default function OverlayWorkspace({ active = true }: { active?: boolean }) {
    const overlay = useOverlay();
    if (!overlay) return null;
    const { host } = overlay;
    const status: HostStatus = host.state ? 'connected' : host.lost ? 'lost' : 'off';
    return (
        <div className="flex flex-col gap-4 px-6 pt-[22px] pb-6 max-w-[1600px] mx-auto w-full min-w-0" data-active={active}>
            <header className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-[22px] font-semibold leading-none text-kb-ink">Overlay</h1>
                <HostStatusPill status={status} build={host.state ? host.build : null} />
            </header>
            <StatusNotice overlay={overlay} />
            {host.state ? <HostCard overlay={overlay} />
                // Lost: Host is installed and stopped answering, so neither the card nor the install well.
                : host.lost ? null
                : PARANOID ? <ParanoidWell /> : <DesktopOverlayWell onConnect={host.local ? undefined : host.connect} />}
            <PreviewCard overlay={overlay} />
            <LayoutRow overlay={overlay} />
            {!overlay.following && <LayersRow overlay={overlay} />}
        </div>
    );
}

/** At most one notice, in priority order: lost, can't reach, command failed, outdated (§5.14 Status area). */
function StatusNotice({ overlay: { host } }: { overlay: OverlayModel }) {
    if (host.lost) return <Notice tone="error">Keybard Host connection lost</Notice>;
    if (!host.state && host.unreachable) {
        return <Notice tone="error" action={<ConnectButton onConnect={host.connect} label="Try again" />}>{host.error}</Notice>;
    }
    if (host.state && host.error) return <Notice tone="error">{host.error}</Notice>;
    if (host.state && hostOutdated(host.build)) return <HostOutdatedNotice build={host.build} />;
    return null;
}

function HostCard({ overlay }: { overlay: OverlayModel }) {
    const state = overlay.host.state!;
    const command = overlay.host.command;
    return (
        <section aria-label="Keybard Host" className={cn(CARD, 'p-4 flex flex-wrap items-center gap-3')}>
            <span id="overlay-board-label" className={ROW_TITLE}>Board</span>
            <Select value={state.selectedDevice ?? ''} onValueChange={overlay.connectBoard}>
                <SelectTrigger aria-labelledby="overlay-board-label" className="min-w-56 max-w-full bg-kb-surface">
                    <SelectValue placeholder="Select a Svalboard" />
                </SelectTrigger>
                <SelectContent>
                    {state.devices.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
            </Select>
            {!state.valid && <span role="status" className="text-sm text-muted-foreground">{state.status}</span>}
            {/* Keybard Host vLaunch2.2 hides and shows the overlay from its handle menu and the tray, not from here. */}
            {!state.visible && <span className="text-sm text-muted-foreground">Desktop overlay hidden</span>}
            <span className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void command({ op: 'reload' })}><RotateCw />Reload layout</Button>
                <Button variant="ghost" onClick={() => void command({ op: 'disconnect' })}><Unplug />Disconnect</Button>
            </span>
            <HostVersion build={overlay.host.build} />
        </section>
    );
}

function PreviewCard({ overlay: o }: { overlay: OverlayModel }) {
    const background = PREVIEW_BACKGROUNDS[o.background];
    // The selection ring never sits on the Recall target, so it can't give the answer away; the
    // Familiar-bindings selection returns when the card moves on (§5.14 Recall target).
    const ringed = o.selected === null || (o.recall && o.selected === o.target?.id) ? undefined : o.selected;
    const emptyTitle = o.noBoard ? 'No board selected' : o.following ? 'No layout from the board yet' : 'No physical keys in this layout';
    return (
        <section aria-label="Preview" className={cn(CARD, 'overflow-hidden')}>
            <div data-preview-background={o.background} className="flex min-h-[200px] items-center justify-center overflow-auto px-6 py-7" style={background.style}>
                {o.keys.length ? (
                    <div className="shrink-0 mx-auto [&_svg]:block [&_svg]:w-full [&_svg]:overflow-visible [&_g]:cursor-pointer" style={{ width: `${o.prefs.scale}%` }}>
                        <OverlaySurface keys={o.keys} appearance={o.appearance} changed={o.changed} held={o.held} effect={o.prefs.effect} duration={o.prefs.duration}
                            hidden={o.hidden} target={o.recall && o.revealed ? o.target?.id : undefined} onSelect={o.setSelected}
                            selected={ringed} selectionHalo={background.halo} />
                    </div>
                ) : (
                    <div className="rounded-md border-dashed border-1 bg-transparent px-6 py-6 text-base font-semibold" style={{ borderColor: background.muted, color: background.muted }}>
                        {emptyTitle}
                    </div>
                )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm text-muted-foreground">
                <span data-preview-source className="min-w-0 [overflow-wrap:anywhere]">{o.sourceName}</span>
                <span className="flex items-center gap-2.5">
                    <span aria-hidden="true">Background</span>
                    <SegmentedControl<PreviewBackground> label="Preview background" value={o.background} onChange={o.setBackground}
                        options={PREVIEW_BACKGROUND_NAMES.map(name => ({ value: name, label: name }))} />
                </span>
            </div>
        </section>
    );
}

function LayoutRow({ overlay: o }: { overlay: OverlayModel }) {
    const input = useRef<HTMLInputElement>(null);
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-3">
                <span id="overlay-layout-label" className={cn(ROW_TITLE, 'min-w-24')}>Layout</span>
                <Select value={o.sourceValue} onValueChange={v => o.chooseSource(v as LayoutSource)}>
                    <SelectTrigger aria-labelledby="overlay-layout-label" className="min-w-60 max-w-full bg-kb-surface">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {o.sourceOptions.map(option => <SelectItem key={option.value} value={option.value}>
                            {option.label}
                            {/* SelectItem and the trigger lay their children out with a gap, so no space is needed. */}
                            {option.suffix && <span className={option.pending ? 'text-amber-800 dark:text-amber-300' : 'text-muted-foreground'}>{option.suffix}</span>}
                        </SelectItem>)}
                    </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => input.current?.click()}><Upload />Import layout…</Button>
                <input ref={input} type="file" accept=".svil,.vil,.viable,.json,.kbi" hidden aria-hidden="true" tabIndex={-1}
                    onChange={e => { void o.importLayout(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
            {o.importError && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{o.importError}</p>}
        </div>
    );
}

function LayersRow({ overlay: o }: { overlay: OverlayModel }) {
    return (
        <div className="flex flex-wrap items-center gap-3">
            <span id="overlay-default-layer-label" className={cn(ROW_TITLE, 'min-w-24')}>Default layer</span>
            <Select value={String(o.base)} onValueChange={v => o.setBase(Number(v))}>
                <SelectTrigger aria-labelledby="overlay-default-layer-label" className="min-w-40 max-w-full bg-kb-surface">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {o.layers.map(l => <SelectItem key={l.index} value={String(l.index)}>{l.label}</SelectItem>)}
                </SelectContent>
            </Select>
            <span id="overlay-preview-layer-label" className={cn(ROW_TITLE, 'sm:ml-3')}>Preview</span>
            <div role="group" aria-labelledby="overlay-preview-layer-label" className="flex flex-wrap items-center gap-2">
                {o.layers.map(l => {
                    const current = o.layer === l.index;
                    return (
                        <button key={l.index} type="button" aria-pressed={current} aria-label={`${l.label}${l.index === o.base ? ', default layer' : ''}`}
                            onClick={() => o.setLayer(l.index)}
                            className={cn(
                                'inline-flex items-center gap-1.5 px-4 py-1 rounded-full transition-colors text-sm font-medium cursor-pointer border-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 whitespace-nowrap',
                                current
                                    ? 'bg-gray-800 text-white dark:bg-neutral-200 dark:text-neutral-900 shadow-md scale-105'
                                    : 'bg-transparent text-gray-600 dark:text-neutral-300 hover:bg-gray-200 dark:hover:bg-neutral-700',
                            )}>
                            <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: l.color }} />
                            {l.index === o.base && <House aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
                            {l.index}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
