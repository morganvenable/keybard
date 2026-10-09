import type { ReactNode } from 'react';
import { AppWindow, Brain, Palette, RotateCcw, Zap, type LucideIcon } from 'lucide-react';
import { ColorField } from '@/components/shared/ColorField';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { PILL_INK } from '@/components/shared/pills';
import OnOffToggle from '@/components/ui/OnOffToggle';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { PRESETS, type Appearance, type Preferences } from './core';
import { useOverlay } from './OverlayProvider';
import type { OverlayModel, OverlayTile } from './useOverlayController';

// O2 Overlay panel (docs/practice/spec.md §5.15), the detail panel content for the Overlay workspace:
// category tiles Window · Appearance · Feedback · Recall, setting rows, and a footer while Host
// settings are being written. Rows that need Keybard Host are hidden, not disabled, while it isn't
// connected. Esc closes the panel (SecondarySidebar, useWorkspacePanelEscape).

const TILES: { name: OverlayTile; icon: LucideIcon }[] = [
    { name: 'Window', icon: AppWindow },
    { name: 'Appearance', icon: Palette },
    { name: 'Feedback', icon: Zap },
    { name: 'Recall', icon: Brain },
];

/** Labels for the stored layer-change values, which don't change (core.ts). */
const EFFECTS: { value: Preferences['effect']; label: string }[] = [
    { value: 'Off', label: 'Off' },
    { value: 'Quick flash', label: 'Flash' },
    { value: 'Short fade', label: 'Fade' },
];
const HANDS: Preferences['hands'][] = ['Both', 'Left', 'Right'];

export default function OverlayPanel({ horizontal = false }: { horizontal?: boolean }) {
    const overlay = useOverlay();
    if (!overlay) return null;
    const { tile, setTile } = overlay;
    return (
        <div data-overlay-panel className="flex flex-col gap-1 pt-1">
            <div className="flex flex-row gap-2 w-full mb-2" role="group" aria-label="Overlay settings">
                {TILES.map(({ name, icon: Icon }) => (
                    <button
                        type="button"
                        key={name}
                        aria-pressed={tile === name}
                        onClick={() => setTile(name)}
                        className={cn(
                            'w-0 min-w-0 flex-1 flex items-center gap-2 flex-col cursor-pointer py-3 rounded-lg transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
                            tile === name ? 'bg-kb-active text-kb-active-fg hover:bg-kb-active/80 hover:text-kb-active-fg' : 'text-muted-foreground hover:bg-muted bg-muted/60',
                        )}
                    >
                        <Icon aria-hidden="true" className="h-4 w-4" />
                        <span className="text-xs font-medium text-center break-words">{name}</span>
                    </button>
                ))}
            </div>
            <div className={horizontal ? 'grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-x-4 items-start' : 'flex flex-col'}>
                {tile === 'Window' && <WindowRows overlay={overlay} />}
                {tile === 'Appearance' && <AppearanceRows overlay={overlay} />}
                {tile === 'Feedback' && <FeedbackRows overlay={overlay} />}
                {tile === 'Recall' && <RecallRows overlay={overlay} />}
            </div>
            <PanelFooter overlay={overlay} />
        </div>
    );
}

function Row({ title, value, children, className }: { title: ReactNode; value?: ReactNode; children?: ReactNode; className?: string }) {
    return (
        <div className={cn('flex flex-row flex-wrap items-center justify-between p-3 gap-3 panel-layer-item', className)}>
            <div className="flex flex-col items-start gap-1 flex-1 basis-44 min-w-0">
                <span className="text-md text-left">{title}</span>
                {value && <span className="text-xs text-muted-foreground">{value}</span>}
            </div>
            {children}
        </div>
    );
}

function SliderRow({ title, display, value, min, max, step = 1, onChange }: { title: string; display: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
    return (
        <div className="flex flex-col gap-3 p-3 panel-layer-item">
            <div className="flex items-center justify-between gap-3">
                <span className="text-md text-left">{title}</span>
                <span className="text-sm text-muted-foreground tabular-nums whitespace-nowrap">{display}</span>
            </div>
            <Slider aria-label={title} value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
        </div>
    );
}

type ColorName = 'fill' | 'outline' | 'legend' | 'changed' | 'pressed';
type AlphaName = 'fillAlpha' | 'outlineAlpha' | 'legendAlpha';

function ColorRow({ overlay, title, name, alpha }: { overlay: OverlayModel; title: string; name: ColorName; alpha?: AlphaName }) {
    const value = overlay.appearance[name];
    return (
        <div className="flex flex-col gap-3 p-3 panel-layer-item">
            <div className="flex items-center justify-between gap-3">
                <span className="text-md text-left">{title}</span>
                <span className="flex items-center gap-2.5">
                    <span className="font-mono text-sm text-muted-foreground">{value}</span>
                    <ColorField label={title} value={value} onChange={hex => overlay.setAppearance(name, hex)} />
                </span>
            </div>
            {alpha && <div className="flex items-center gap-3">
                <span className="w-14 text-xs text-muted-foreground">Opacity</span>
                <Slider aria-label={`${title} opacity`} className="flex-1" value={[overlay.appearance[alpha]]} min={0} max={100}
                    onValueChange={([v]) => overlay.setAppearance(alpha, v)} />
                <span className="w-14 text-right text-sm text-muted-foreground tabular-nums whitespace-nowrap">{overlay.appearance[alpha]} %</span>
            </div>}
        </div>
    );
}

function WindowRows({ overlay: o }: { overlay: OverlayModel }) {
    const state = o.host.state;
    const command = o.host.command;
    const manualDefault = state ? Math.max(0, Math.log2(state.config.manualDefault || 1)) : 0;
    return <>
        <Row title="Hands">
            <SegmentedControl label="Hands" value={o.prefs.hands} onChange={v => o.update('hands', v)} options={HANDS.map(h => ({ value: h, label: h }))} />
        </Row>
        <SliderRow title="Size" display={`${o.prefs.scale} %`} value={o.prefs.scale} min={50} max={150} onChange={v => o.update('scale', v)} />
        {state && <>
            <Row title={<Tooltip>
                <TooltipTrigger asChild>
                    <span tabIndex={0} className="underline decoration-dotted decoration-muted-foreground underline-offset-4 cursor-help rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Drag by keys</span>
                </TooltipTrigger>
                <TooltipContent side="top">Move the overlay by its keys as well as by its handle</TooltipContent>
            </Tooltip>}>
                <OnOffToggle label="Drag by keys" value={state.arrange} onToggle={v => void command({ op: 'arrange', value: v })} />
            </Row>
            <Row title="Position">
                <Button variant="outline" onClick={() => void command({ op: 'place' })}>Place at bottom</Button>
            </Row>
            {/* Older firmware doesn't report its default layer; this Host-wide setting stands in for it. */}
            {state.default === null && <Row title={<span id="overlay-desktop-default-label">Desktop default layer</span>} value="Older firmware">
                <Select value={String(manualDefault)} onValueChange={v => o.setManualDefault(Number(v))}>
                    <SelectTrigger aria-labelledby="overlay-desktop-default-label" className="min-w-36 max-w-full bg-kb-surface"><SelectValue /></SelectTrigger>
                    <SelectContent>{o.layers.map(l => <SelectItem key={l.index} value={String(l.index)}>{l.label}</SelectItem>)}</SelectContent>
                </Select>
            </Row>}
        </>}
        <Row title="Reset">
            <Button variant="outline" onClick={o.resetPreferences}><RotateCcw />Reset appearance and view</Button>
        </Row>
    </>;
}

function AppearanceRows({ overlay: o }: { overlay: OverlayModel }) {
    const a: Appearance = o.appearance;
    return <>
        <Row title={<span id="overlay-preset-label">Preset</span>}>
            <Select value={o.preset} onValueChange={o.applyPreset}>
                <SelectTrigger aria-labelledby="overlay-preset-label" className="min-w-44 max-w-full bg-kb-surface"><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="Custom" disabled>Custom</SelectItem>
                    {Object.keys(PRESETS).map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                </SelectContent>
            </Select>
        </Row>
        <ColorRow overlay={o} title="Key fill" name="fill" alpha="fillAlpha" />
        <ColorRow overlay={o} title="Outline" name="outline" alpha="outlineAlpha" />
        <ColorRow overlay={o} title="Legend" name="legend" alpha="legendAlpha" />
        <SliderRow title="Outline thickness" display={`${a.width} px`} value={a.width} min={0} max={4} step={0.5} onChange={v => o.setAppearance('width', v)} />
        <Row title="Legend halo">
            <OnOffToggle label="Legend halo" value={a.halo} onToggle={v => o.setAppearance('halo', v)} />
        </Row>
        <ColorRow overlay={o} title="Layer change" name="changed" />
        <ColorRow overlay={o} title="Pressed key" name="pressed" />
    </>;
}

function FeedbackRows({ overlay: o }: { overlay: OverlayModel }) {
    const state = o.host.state;
    return <>
        <Row title="Layer-change highlight">
            <SegmentedControl label="Layer-change highlight" value={o.prefs.effect} onChange={v => o.update('effect', v)} options={EFFECTS} />
        </Row>
        {/* Hidden rather than disabled while the highlight is off. */}
        {o.prefs.effect !== 'Off' && <SliderRow title="Duration" display={`${o.prefs.duration} ms`} value={o.prefs.duration} min={50} max={750} step={25} onChange={v => o.update('duration', v)} />}
        {state && <Row title="Highlight held keys">
            <OnOffToggle label="Highlight held keys" value={state.config.highlightPressed} onToggle={v => { if (!o.host.busy) o.setHighlightPressed(v); }} />
        </Row>}
        {state?.matrixAvailable === false && <Row title="Held keys"><span className="text-sm text-muted-foreground">Unavailable on this firmware</span></Row>}
        <Row title="Preview">
            <Button variant="outline" onClick={o.previewHeld}>Preview held keys</Button>
        </Row>
    </>;
}

function RecallRows({ overlay: o }: { overlay: OverlayModel }) {
    const target = o.target;
    return <>
        <Row title="Recall">
            <OnOffToggle label="Recall" value={o.recall} onToggle={o.setRecall} />
        </Row>
        {/* Following the board, Recall hides the desktop overlay's legends too. */}
        {o.following && o.recall && <Row title="Desktop legends"><span className="text-sm text-muted-foreground">Hidden while recalling</span></Row>}
        {o.recall && target && <section aria-label="Recall card" className="mx-3 my-2 bg-kb-surface rounded-2xl border border-gray-200 dark:border-neutral-700 p-4 text-center flex flex-col items-center gap-1.5 shadow-sm">
            <span className="text-xs font-medium text-muted-foreground">Find this binding</span>
            <strong className="text-[22px] font-semibold leading-tight text-kb-ink [overflow-wrap:anywhere]">{target.label.split('\n').join(' ')}</strong>
            <span className="text-sm text-muted-foreground">{target.hand} hand</span>
            {o.revealed ? <span className="flex flex-wrap justify-center gap-2 pt-1">
                <button type="button" className={PILL_INK} onClick={() => o.grade(true)}>Remembered</button>
                <Button variant="outline" className="rounded-full" onClick={() => o.grade(false)}>Again</Button>
            </span> : <span className="pt-1"><button type="button" className={PILL_INK} onClick={o.reveal}>Reveal</button></span>}
            <span className="text-xs text-muted-foreground tabular-nums">{o.correct} remembered · {o.attempts} attempts</span>
        </section>}
        <h3 className="px-1 pt-3.5 pb-0.5 text-xs font-medium text-muted-foreground">Familiar bindings</h3>
        <Row title={<span id="overlay-binding-label">Binding</span>}>
            <Select value={o.selected === null ? '' : String(o.selected)} onValueChange={v => o.setSelected(Number(v))}>
                <SelectTrigger aria-labelledby="overlay-binding-label" className="min-w-44 max-w-full bg-kb-surface"><SelectValue placeholder="Select a key in the preview" /></SelectTrigger>
                <SelectContent>{o.learnable.map(k => <SelectItem key={k.id} value={String(k.id)}>{k.hand} · {k.label.split('\n').join(' ')} · {k.id}</SelectItem>)}</SelectContent>
            </Select>
        </Row>
        <div className="flex flex-wrap justify-end gap-2 px-3 pb-3">
            {o.chosen && o.chosen.code > 1 && <Button variant="outline" onClick={o.markFamiliar}>Mark familiar</Button>}
            <Button variant="ghost" onClick={o.clearFamiliar}>Clear</Button>
        </div>
        <Row title="Hide familiar legends">
            <OnOffToggle label="Hide familiar legends" value={o.hideFamiliar} onToggle={o.setHideFamiliar} />
        </Row>
    </>;
}

/** Saving… while a Host write is pending or in flight; a line when localStorage refused the settings. */
function PanelFooter({ overlay: o }: { overlay: OverlayModel }) {
    if (!o.saving && !o.storageError) return null;
    return (
        <div role="status" className="sticky bottom-0 mt-2 flex items-center gap-2 bg-sidebar-background px-1 py-3 text-xs text-muted-foreground">
            {o.storageError
                ? <span className="text-red-700 dark:text-red-400">Settings couldn't be saved</span>
                : <><span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-kb-pending" />Saving…</>}
        </div>
    );
}
