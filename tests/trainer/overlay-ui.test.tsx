import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import OverlayWorkspace from '@/features/trainer/OverlayWorkspace';
import OverlayPanel from '@/features/trainer/OverlayPanel';
import { DEFAULTS, PRESETS } from '@/features/trainer/core';
import { surfaceKeys } from '@/features/trainer/useSurfaceKeys';
import { HOST_RELEASE, HOST_RELEASE_TAG } from '@/features/trainer/HostInstall';
import type { OverlayModel } from '@/features/trainer/useOverlayController';
import { useWorkspacePanelEscape } from '@/hooks/useWorkspacePanelEscape';

// O1 page and O2 panel per Host state (docs/practice/spec.md §5.14-§5.16, §9.9 "Overlay (MO)"). The
// model is a stand-in for OverlayEngine's, so each state can be set directly; the engine's own logic is
// covered in overlay-controller.test.tsx.

const flags = vi.hoisted(() => ({ paranoid: false }));
vi.mock('@/lib/paranoid', () => ({ get PARANOID() { return flags.paranoid; } }));
const model = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/features/trainer/OverlayProvider', () => ({ useOverlay: () => model.current }));

beforeAll(() => {
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.releasePointerCapture ??= () => undefined;
    Element.prototype.scrollIntoView ??= () => undefined;
});
beforeEach(() => {
    flags.paranoid = false;
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => vi.unstubAllGlobals());

const board = { rows: 10, cols: 6, keymap: [Array(60).fill(4), Array(60).fill(5)], trainerLabels: {}, cosmetic: { layer: { 0: 'Base' }, layer_colors: {} },
    keylayout: { 0: { row: 0, col: 0, x: 0, y: 0, w: 1, h: 1 }, 1: { row: 0, col: 1, x: 1, y: 0, w: 1, h: 1 }, 2: { row: 0, col: 2, x: 2, y: 0, w: 1, h: 1 } } };
const keys = surfaceKeys(board, 1, 1, 'Both');
const hostState = (over: Record<string, unknown> = {}) => ({ apiVersion: 1, revision: 1, layoutRevision: 1, session: 's', board, selectedDevice: 'mule', status: 'Ready',
    devices: [{ id: 'mule', name: 'Svalboard · Mule', serial: '' }], config: { ...DEFAULTS, manualDefault: 1, highlightPressed: true },
    active: 1, default: 1, valid: true, pressed: [], practiceHidden: [], practiceTarget: null, matrixAvailable: true, visible: true, arrange: false, ...over });

type Over = Partial<Omit<OverlayModel, 'host'>> & { host?: Partial<OverlayModel['host']> };
function overlay(over: Over = {}): OverlayModel {
    const { host, ...rest } = over;
    const base = {
        host: { state: null, error: '', lost: false, unreachable: false, busy: false, local: false, build: null,
            command: vi.fn(async () => undefined), configure: vi.fn(async () => true), connect: vi.fn(), ...host },
        following: false, board, keys, changed: new Set<number>(), held: new Set<number>(), hidden: new Set<number>(), target: keys[0], revealed: false, recall: false,
        attempts: 0, correct: 0, learnable: keys, selected: null, chosen: undefined, familiar: new Set<string>(), hideFamiliar: false,
        prefs: { ...DEFAULTS, appearance: { ...DEFAULTS.appearance } }, appearance: { ...DEFAULTS.appearance }, preset: 'Outline only', storageError: false, saving: false,
        tile: 'Appearance', background: 'Dark', layer: 0, base: 0, importError: '',
        sourceOptions: [{ value: 'snapshot', label: 'sval-default.svil' }, { value: 'example', label: 'QWERTY example' }], sourceValue: 'snapshot', sourceName: 'sval-default.svil', noBoard: false,
        layers: [{ index: 0, label: '0 · Base', color: '#099e7c' }, { index: 1, label: '1 · Layer 1', color: '#f89804' }],
        hostLayers: [{ index: 0, label: '0 · Base', color: '#099e7c' }, { index: 1, label: '1 · Layer 1', color: '#f89804' }], highlightPressed: true, manualDefault: 1,
        setTile: vi.fn(), setBackground: vi.fn(), setLayer: vi.fn(), setBase: vi.fn(), setSelected: vi.fn(), setHideFamiliar: vi.fn(), setRecall: vi.fn(),
        update: vi.fn(), setAppearance: vi.fn(), applyPreset: vi.fn(), resetPreferences: vi.fn(), grade: vi.fn(), reveal: vi.fn(), markFamiliar: vi.fn(),
        clearFamiliar: vi.fn(), previewHeld: vi.fn(), chooseSource: vi.fn(), importLayout: vi.fn(), connectBoard: vi.fn(), setHighlightPressed: vi.fn(), setManualDefault: vi.fn(),
    };
    return { ...base, ...rest } as unknown as OverlayModel;
}
const connected = (over: Record<string, unknown> = {}, hostOver: Partial<OverlayModel['host']> = {}) =>
    ({ host: { state: hostState(over), build: { version: HOST_RELEASE_TAG, keybardCommit: '61db58a' }, ...hostOver } as Partial<OverlayModel['host']>, following: true,
        sourceOptions: [{ value: 'live' as const, label: 'Live board', suffix: '· read-only' }], sourceValue: 'live' as const, sourceName: 'Live board' });

const page = (over: Over = {}) => { model.current = overlay(over); return render(<OverlayWorkspace />); };
const panel = (over: Over = {}) => { model.current = overlay(over); return render(<OverlayPanel />); };
const status = () => screen.getAllByRole('status').find(el => el.hasAttribute('data-host-status'))!;

describe('O1 Overlay page', () => {
    it('without Host on the web: the Desktop overlay well with Connect, and the preview, Layout and Layers rows', () => {
        page();
        expect(screen.getByRole('heading', { level: 1, name: 'Overlay' })).toBeInTheDocument();
        expect(status()).toHaveTextContent('Keybard Host not connected');
        expect(screen.getByRole('heading', { name: 'Desktop overlay' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Connect to Keybard Host/ })).toBeInTheDocument();
        expect(screen.queryByRole('region', { name: 'Keybard Host' })).toBeNull();
        expect(screen.getByRole('img', { name: 'Overlay keyboard preview' })).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: 'Layout' })).toHaveTextContent('sval-default.svil');
        expect(screen.getByRole('combobox', { name: 'Default layer' })).toHaveTextContent('0 · Base');
        // The default layer's pill carries the House icon.
        const pills = within(screen.getByRole('group', { name: 'Preview' }));
        expect(pills.getByRole('button', { name: '0 · Base, default layer' })).toHaveAttribute('aria-pressed', 'true');
        expect(pills.getByRole('button', { name: '0 · Base, default layer' }).querySelector('svg.lucide-house')).not.toBeNull();
        expect(pills.getByRole('button', { name: '1 · Layer 1' })).toHaveAttribute('aria-pressed', 'false');
        // No prose on the page.
        expect(document.querySelector('p')).toBeNull();
    });

    it('offers no Connect on a page Keybard Host serves', () => {
        page({ host: { local: true } });
        expect(screen.getByRole('heading', { name: 'Desktop overlay' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Connect to Keybard Host/ })).toBeNull();
    });

    it('shows only the command to run in Keybard Paranoid', () => {
        flags.paranoid = true;
        page();
        expect(screen.getByRole('heading', { name: 'Start Keybard Host in paranoid mode' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Desktop overlay' })).toBeNull();
        expect(screen.queryByRole('button', { name: /Connect/ })).toBeNull();
    });

    it("says it can't reach Host after Connect, with Try again above the well", () => {
        const connect = vi.fn();
        page({ host: { unreachable: true, error: "Can't reach Keybard Host at 127.0.0.1:5178", connect } });
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent("Can't reach Keybard Host at 127.0.0.1:5178");
        fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
        expect(connect).toHaveBeenCalledOnce();
        expect(screen.getByRole('heading', { name: 'Desktop overlay' })).toBeInTheDocument();
    });

    it('on a lost connection: red status, one error notice, no Host card and no Desktop overlay well', () => {
        page({ host: { lost: true } });
        expect(status()).toHaveTextContent('Keybard Host connection lost');
        expect(status().querySelector('.bg-kb-red')).not.toBeNull();
        expect(screen.getByRole('alert')).toHaveTextContent('Keybard Host connection lost');
        expect(screen.queryByRole('region', { name: 'Keybard Host' })).toBeNull();
        expect(screen.queryByRole('heading', { name: 'Desktop overlay' })).toBeNull();
        // The preview shows the Layout select's own source.
        expect(screen.getByRole('img', { name: 'Overlay keyboard preview' })).toBeInTheDocument();
    });

    it('with Host: the Host card, its commands and facts, and the Layout select following the live board', () => {
        const command = vi.fn(async () => undefined);
        page(connected({}, { command }));
        expect(status()).toHaveTextContent(`Keybard Host ${HOST_RELEASE_TAG}`);
        const card = within(screen.getByRole('region', { name: 'Keybard Host' }));
        expect(card.getByRole('combobox', { name: 'Board' })).toHaveTextContent('Svalboard · Mule');
        fireEvent.click(card.getByRole('button', { name: 'Reload layout' }));
        fireEvent.click(card.getByRole('button', { name: 'Disconnect' }));
        expect(command.mock.calls).toEqual([[{ op: 'reload' }], [{ op: 'disconnect' }]]);
        expect(card.getByText(`Keybard Host ${HOST_RELEASE_TAG} · Keybard 61db58a`)).toBeInTheDocument();
        // vLaunch2.2 Hosts hide and show the overlay themselves; there is no Hide button here.
        expect(card.queryByRole('button', { name: /overlay/i })).toBeNull();
        expect(screen.getByRole('combobox', { name: 'Layout' })).toHaveTextContent('Live board· read-only');
        expect(screen.queryByRole('combobox', { name: 'Default layer' })).toBeNull();
        expect(screen.queryByRole('heading', { name: 'Desktop overlay' })).toBeNull();
    });

    it("prints a failed Host command, and Host's status while the board isn't valid", () => {
        page(connected({ valid: false, status: 'Reading the layout' }, { error: 'Board is busy' }));
        expect(screen.getByRole('alert')).toHaveTextContent('Board is busy');
        expect(within(screen.getByRole('region', { name: 'Keybard Host' })).getByText('Reading the layout')).toBeInTheDocument();
    });

    it('notes a hidden desktop overlay', () => {
        page(connected({ visible: false }));
        expect(screen.getByText('Desktop overlay hidden')).toBeInTheDocument();
    });

    it('points an older Host at the current release', () => {
        page(connected({}, { build: { version: 'vLaunch2.1', keybardCommit: null } }));
        expect(screen.getByText(`Keybard Host ${HOST_RELEASE_TAG} is available`)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute('href', HOST_RELEASE);
    });

    it('with no board chosen: a dashed No board selected well and the source No board', () => {
        page({ ...connected({ selectedDevice: null, board: null, valid: false }), keys: [], noBoard: true, sourceName: 'No board' });
        expect(screen.getByText('No board selected')).toBeInTheDocument();
        expect(screen.queryByRole('img', { name: 'Overlay keyboard preview' })).toBeNull();
        expect(document.querySelector('[data-preview-source]')).toHaveTextContent('No board');
        expect(screen.getByRole('combobox', { name: 'Board' })).toHaveTextContent('Select a Svalboard');
    });

    it('prints an import error under the Layout row', () => {
        page({ importError: 'Choose a Svalboard layout with a 10 × 6 matrix' });
        expect(screen.getByRole('alert')).toHaveTextContent('Choose a Svalboard layout with a 10 × 6 matrix');
        expect(screen.getByRole('button', { name: 'Import layout…' })).toBeInTheDocument();
    });

    it('paints the chosen desktop stand-in and switches it with the Background control', () => {
        const setBackground = vi.fn();
        page({ background: 'Busy', setBackground });
        expect(document.querySelector('[data-preview-background="Busy"]')).not.toBeNull();
        fireEvent.click(screen.getByRole('radio', { name: 'Light' }));
        expect(setBackground).toHaveBeenCalledWith('Light', 'pointer');
    });

    it('rings the Familiar-bindings key, but never the Recall target', () => {
        const { unmount } = page({ selected: keys[1].id });
        expect(document.querySelector('[data-selection-ring]')).not.toBeNull();
        unmount();
        page({ selected: keys[0].id, recall: true, target: keys[0] });
        expect(document.querySelector('[data-selection-ring]')).toBeNull();
    });
});

describe('O2 Overlay panel', () => {
    it('opens on Appearance, with four category tiles', () => {
        const setTile = vi.fn();
        panel({ setTile });
        const tiles = within(screen.getByRole('group', { name: 'Overlay settings' })).getAllByRole('button');
        expect(tiles.map(t => t.textContent)).toEqual(['Window', 'Appearance', 'Feedback', 'Recall']);
        expect(screen.getByRole('button', { name: 'Appearance' })).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(screen.getByRole('button', { name: 'Recall' }));
        expect(setTile).toHaveBeenCalledWith('Recall');
    });

    it('Window without Host shows Hands, Size and Reset only (Host rows absent, not disabled)', () => {
        panel({ tile: 'Window' });
        expect(screen.getByRole('radiogroup', { name: 'Hands' })).toBeInTheDocument();
        expect(screen.getByRole('slider', { name: 'Size' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Reset appearance and view' })).toBeInTheDocument();
        for (const name of ['Drag by keys', 'Position', 'Desktop default layer']) expect(screen.queryByText(name)).toBeNull();
    });

    it('Window with Host adds Drag by keys and Place at bottom', () => {
        const command = vi.fn(async () => undefined);
        panel({ tile: 'Window', ...connected({}, { command }) });
        fireEvent.click(within(screen.getByRole('group', { name: 'Drag by keys' })).getByRole('button', { name: 'ON' }));
        fireEvent.click(screen.getByRole('button', { name: 'Place at bottom' }));
        expect(command.mock.calls).toEqual([[{ op: 'arrange', value: true }], [{ op: 'place' }]]);
        expect(screen.queryByText('Desktop default layer')).toBeNull();
    });

    it("lists the layers of the board Host reads, and shows the highest bit of a multi-layer mask", () => {
        panel({ tile: 'Window', ...connected({ default: null, config: { ...DEFAULTS, manualDefault: 0b110, highlightPressed: false } }),
            hostLayers: [0, 1, 2].map(i => ({ index: i, label: `${i} · Host ${i}`, color: '#099e7c' })), manualDefault: 0b110 });
        expect(screen.getByRole('combobox', { name: 'Desktop default layer' })).toHaveTextContent('2 · Host 2');
    });

    it("shows a Desktop default layer choice waiting for Host, not Host's current value", () => {
        panel({ tile: 'Window', ...connected({ default: null }), manualDefault: 0b10 });
        expect(screen.getByRole('combobox', { name: 'Desktop default layer' })).toHaveTextContent('1 · Layer 1');
    });

    it.each([true, false])('shows Desktop default layer whenever Host reports no default layer (following: %s)', (following) => {
        panel({ tile: 'Window', ...connected({ default: null }), following });
        expect(screen.getByText('Desktop default layer')).toBeInTheDocument();
        expect(screen.getByText('Older firmware')).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: 'Desktop default layer' })).toHaveTextContent('0 · Base');
    });

    it('Appearance: preset, three colors with opacity, thickness, halo, layer change and pressed key', () => {
        panel();
        expect(screen.getByRole('combobox', { name: 'Preset' })).toHaveTextContent('Outline only');
        for (const name of ['Key fill', 'Outline', 'Legend', 'Layer change', 'Pressed key']) {
            expect(screen.getByRole('button', { name: new RegExp(`^${name} color, #`) })).toBeInTheDocument();
        }
        expect(screen.getAllByRole('slider', { name: /opacity$/ })).toHaveLength(3);
        expect(screen.getByText(DEFAULTS.appearance.outline)).toBeInTheDocument();
        expect(screen.getByRole('slider', { name: 'Outline thickness' })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Legend halo' })).toBeInTheDocument();
        expect(Object.keys(PRESETS)).toContain('Outline only');
    });

    it('Feedback without Host, highlight off: no Duration and no Highlight held keys', () => {
        panel({ tile: 'Feedback', prefs: { ...DEFAULTS, effect: 'Off' } });
        expect(screen.getByRole('radio', { name: 'Off' })).toHaveAttribute('aria-checked', 'true');
        expect(screen.queryByRole('slider', { name: 'Duration' })).toBeNull();
        expect(screen.queryByText('Highlight held keys')).toBeNull();
        expect(screen.getByRole('button', { name: 'Preview held keys' })).toBeInTheDocument();
    });

    it('Feedback with Host on older firmware: Highlight held keys and Held keys unavailable', () => {
        const setHighlightPressed = vi.fn();
        panel({ tile: 'Feedback', ...connected({ matrixAvailable: false }), setHighlightPressed });
        expect(screen.getByRole('radio', { name: 'Fade' })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('slider', { name: 'Duration' })).toBeInTheDocument();
        expect(screen.getByText('Unavailable on this firmware')).toBeInTheDocument();
        fireEvent.click(within(screen.getByRole('group', { name: 'Highlight held keys' })).getByRole('button', { name: 'OFF' }));
        expect(setHighlightPressed).toHaveBeenCalledWith(false);
    });

    it('Recall: the card shows only the buttons that apply', () => {
        const reveal = vi.fn(), grade = vi.fn();
        const { unmount } = panel({ tile: 'Recall', recall: true, reveal, grade, attempts: 5, correct: 3 });
        const card = within(screen.getByRole('region', { name: 'Recall card' }));
        expect(card.getByText('Find this binding')).toBeInTheDocument();
        expect(card.getByText('3 remembered · 5 attempts')).toBeInTheDocument();
        expect(card.queryByRole('button', { name: 'Remembered' })).toBeNull();
        fireEvent.click(card.getByRole('button', { name: 'Reveal' }));
        expect(reveal).toHaveBeenCalled();
        // Not following: the desktop legends aren't affected.
        expect(screen.queryByText('Desktop legends')).toBeNull();
        unmount();
        panel({ tile: 'Recall', recall: true, revealed: true, grade, following: true });
        const after = within(screen.getByRole('region', { name: 'Recall card' }));
        expect(after.queryByRole('button', { name: 'Reveal' })).toBeNull();
        fireEvent.click(after.getByRole('button', { name: 'Again' }));
        expect(grade).toHaveBeenCalledWith(false);
        expect(screen.getByText('Hidden while recalling')).toBeInTheDocument();
    });

    it('Familiar bindings: Mark familiar shows only with a binding chosen', () => {
        const { unmount } = panel({ tile: 'Recall' });
        expect(screen.getByRole('combobox', { name: 'Binding' })).toHaveTextContent('Select a key in the preview');
        expect(screen.queryByRole('button', { name: 'Mark familiar' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
        unmount();
        panel({ tile: 'Recall', selected: keys[1].id, chosen: keys[1] });
        expect(screen.getByRole('button', { name: 'Mark familiar' })).toBeInTheDocument();
    });

    it('footer: Saving… with the pending dot, or a storage error', () => {
        const { unmount } = panel({ saving: true });
        const footer = screen.getByRole('status');
        expect(footer).toHaveTextContent('Saving…');
        expect(footer.querySelector('.bg-kb-pending')).not.toBeNull();
        unmount();
        panel({ storageError: true });
        expect(screen.getByRole('status')).toHaveTextContent("Settings couldn't be saved");
    });

    it('Esc on the open Preset select closes only the select; a second Esc closes the panel', async () => {
        model.current = overlay();
        const onClose = vi.fn();
        function Host() {
            const onKeyDown = useWorkspacePanelEscape(onClose);
            return <aside tabIndex={-1} aria-label="Overlay" onKeyDown={onKeyDown}><OverlayPanel /></aside>;
        }
        render(<Host />);
        const trigger = screen.getByRole('combobox', { name: 'Preset' });
        trigger.focus();
        await act(async () => { fireEvent.keyDown(trigger, { key: 'ArrowDown' }); });
        await screen.findByRole('option', { name: 'Light' });
        await act(async () => { fireEvent.keyDown(document.activeElement!, { key: 'Escape' }); });
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.queryByRole('listbox')).toBeNull();
        fireEvent.keyDown(document.activeElement && document.activeElement !== document.body ? document.activeElement : trigger, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
