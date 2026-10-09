import { act, render, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULTS } from '@/features/trainer/core';
import { layerOptions, snapshotName, useOverlayController } from '@/features/trainer/useOverlayController';
import { OverlayProvider } from '@/features/trainer/OverlayProvider';

// Overlay's state lifted from TrainerPage (docs/practice/spec.md §12 MO "State lift", §9.9): Host config
// mirroring, Recall publishing gated on the Overlay workspace, the Layout select's source naming and
// the import checks. Keybard Host is a mocked fetch on a Host-served page.

const keyboardState = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const layoutSettings = vi.hoisted(() => ({ internationalLayout: 'us' }));
const panels = vi.hoisted(() => ({ workspace: 'overlay', activePanel: 'overlay' as string | null }));
vi.mock('@/contexts/KeyboardContext', () => ({ useKeyboard: () => keyboardState.current }));
vi.mock('@/contexts/LayoutSettingsContext', () => ({ useLayoutSettings: () => layoutSettings }));
vi.mock('@/contexts/PanelsContext', () => ({ usePanels: () => panels }));

const board = { rows: 10, cols: 6, keymap: [Array(60).fill(4), Array(60).fill(5)], trainerLabels: {}, cosmetic: { layer: { 0: 'Base' }, layer_colors: { 1: 'blue' } },
    keylayout: { 0: { row: 0, col: 0, x: 0, y: 0, w: 1, h: 1 }, 1: { row: 0, col: 1, x: 1, y: 0, w: 1, h: 1 } } };
let snapshot: Record<string, unknown>;
const calls: { path: string; body: Record<string, unknown> }[] = [];
const fetchMock = vi.fn();

beforeEach(() => {
    calls.length = 0;
    keyboardState.current = { keyboard: board, originalKeyboard: board, hasUnsavedChanges: false, isConnected: false, loadedFrom: 'mine.svil' };
    layoutSettings.internationalLayout = 'us';
    panels.workspace = 'overlay';
    panels.activePanel = 'overlay';
    snapshot = { apiVersion: 1, revision: 1, layoutRevision: 1, session: 's', board, selectedDevice: 'mule', status: '', devices: [{ id: 'mule', name: 'Mule', serial: '' }],
        config: { ...DEFAULTS, appearance: { ...DEFAULTS.appearance }, scale: 70, manualDefault: 1, highlightPressed: false },
        active: 1, default: 1, valid: true, pressed: [], practiceHidden: [], practiceTarget: null, matrixAvailable: true, visible: true, arrange: false };
    document.documentElement.dataset.keybardHost = 'true';
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        const path = String(url);
        if (path.endsWith('/api/host/bootstrap')) return new Response(JSON.stringify({ token: 't', apiVersion: 1, version: 'vLaunch2.2' }));
        if (path.includes('/api/host/state')) return new Response(JSON.stringify(snapshot));
        const body = JSON.parse(String(init?.body ?? '{}'));
        calls.push({ path, body });
        if (path.endsWith('/config')) { snapshot = { ...snapshot, revision: (snapshot.revision as number) + 1, config: body.config }; return new Response(JSON.stringify({ revision: snapshot.revision })); }
        return new Response('{"ok":true}');
    });
    vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); delete document.documentElement.dataset.keybardHost; localStorage.clear(); });

const configWrites = () => calls.filter(c => c.path.endsWith('/config'));
const practice = () => calls.filter(c => c.path.endsWith('/command') && c.body.op === 'practice');

describe('Host config mirroring', () => {
    it("adopts Host's config on a new revision while nothing is pending", async () => {
        const { result } = renderHook(() => useOverlayController(true));
        await waitFor(() => expect(result.current.prefs.scale).toBe(70));
        snapshot = { ...snapshot, revision: 2, config: { ...(snapshot.config as object), scale: 80 } };
        await waitFor(() => expect(result.current.prefs.scale).toBe(80));
        expect(configWrites()).toHaveLength(0);
    });

    it('writes a local change 160 ms after it, and shows Saving… meanwhile', async () => {
        const { result } = renderHook(() => useOverlayController(true));
        await waitFor(() => expect(result.current.host.state).not.toBeNull());
        act(() => result.current.update('scale', 120));
        expect(result.current.saving).toBe(true);
        await new Promise(r => setTimeout(r, 80));
        expect(configWrites()).toHaveLength(0);
        await waitFor(() => expect(configWrites()).toHaveLength(1));
        expect(configWrites()[0].body.config).toMatchObject({ scale: 120, highlightPressed: false, manualDefault: 1 });
        await waitFor(() => expect(result.current.saving).toBe(false));
        expect(result.current.prefs.scale).toBe(120);
    });

    it("follows Keybard's international layout into Host's layoutId", async () => {
        layoutSettings.internationalLayout = 'german';
        const { result } = renderHook(() => useOverlayController(true));
        await waitFor(() => expect(configWrites()).toHaveLength(1));
        expect(configWrites()[0].body.config).toMatchObject({ layoutId: 'german' });
        expect(result.current.prefs.layoutId).toBe('german');
    });

    it('never shows Saving… without Host', async () => {
        delete document.documentElement.dataset.keybardHost;
        const { result } = renderHook(() => useOverlayController(true));
        act(() => result.current.update('scale', 90));
        expect(result.current.saving).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(JSON.parse(localStorage.getItem('keybard.trainer.v1')!).scale).toBe(90);
    });
});

describe('Recall publishing', () => {
    it('publishes only while the Overlay workspace is showing, and clears on leave', async () => {
        const { result, rerender } = renderHook(({ active }) => useOverlayController(active), { initialProps: { active: false } });
        await waitFor(() => expect(result.current.host.state).not.toBeNull());
        act(() => result.current.setRecall(true));
        await new Promise(r => setTimeout(r, 50));
        expect(practice()).toHaveLength(0);

        rerender({ active: true });
        await waitFor(() => expect(practice().length).toBeGreaterThan(0));
        expect((practice().at(-1)!.body.hidden as number[]).length).toBeGreaterThan(0);

        const before = practice().length;
        rerender({ active: false });
        await waitFor(() => expect(practice().length).toBe(before + 1));
        expect(practice().at(-1)!.body).toEqual({ op: 'practice', hidden: [], target: null });
    });

    it('runs whether or not the Overlay panel is open (OverlayEngine gates on the workspace)', async () => {
        panels.activePanel = 'settings';
        render(<OverlayProvider><span /></OverlayProvider>);
        await waitFor(() => expect(practice().length).toBeGreaterThan(0));
        panels.workspace = 'editor';
    });

    it('keeps the Familiar-bindings selection while Recall runs', () => {
        delete document.documentElement.dataset.keybardHost;
        const { result } = renderHook(() => useOverlayController(true));
        expect(result.current.keys.length).toBeGreaterThan(0);
        act(() => result.current.setSelected(result.current.keys[0].id));
        act(() => result.current.setRecall(true));
        expect(result.current.target?.id).toBe(result.current.keys[0].id);
        expect(result.current.selected).toBe(result.current.keys[0].id);
    });
});

describe('sources and layers', () => {
    it('names the snapshot after where it came from', () => {
        expect(snapshotName(true, 'Svalboard', true)).toBe('Connected board');
        expect(snapshotName(false, 'mine.svil', true)).toBe('mine.svil');
        expect(snapshotName(false, 'QWERTY example (demo)', true)).toBe('QWERTY example (demo)');
        expect(snapshotName(false, null, true)).toBe('Loaded layout');
        expect(snapshotName(false, null, false)).toBe('QWERTY example');
    });

    it('lists the sources, following the board while Host is connected', async () => {
        keyboardState.current = { ...keyboardState.current, hasUnsavedChanges: true };
        const { result } = renderHook(() => useOverlayController(true));
        expect(result.current.sourceOptions.map(o => o.value)).toEqual(['snapshot', 'draft', 'example']);
        expect(result.current.sourceOptions[0].label).toBe('mine.svil');
        expect(result.current.sourceOptions[1]).toMatchObject({ label: 'Editor draft', suffix: '· unsaved changes', pending: true });
        await waitFor(() => expect(result.current.following).toBe(true));
        expect(result.current.sourceOptions[0]).toMatchObject({ value: 'live', label: 'Live board', suffix: '· read-only' });
        expect(result.current.sourceName).toBe('Live board');
        act(() => result.current.chooseSource('example'));
        expect(result.current.following).toBe(false);
        expect(result.current.sourceName).toBe('QWERTY example');
    });

    it("reads No board while Host follows with no board chosen", async () => {
        snapshot = { ...snapshot, selectedDevice: null, board: null, valid: false };
        const { result } = renderHook(() => useOverlayController(true));
        await waitFor(() => expect(result.current.noBoard).toBe(true));
        expect(result.current.sourceName).toBe('No board');
        expect(result.current.keys).toEqual([]);
    });

    it('labels layers "0 · Base" with their layer colors', () => {
        expect(layerOptions(board as never)).toEqual([
            { index: 0, label: '0 · Base', color: '#099e7c' },
            { index: 1, label: '1 · Layer 1', color: '#379cd7' },
        ]);
    });

    it('imports only 10 × 6 Svalboard layouts, with a line saying why not', async () => {
        delete document.documentElement.dataset.keybardHost;
        const { result } = renderHook(() => useOverlayController(true));
        const small = new File([JSON.stringify({ uid: 1, layout: [[['KC_A']]] })], 'small.vil');
        await act(async () => { await result.current.importLayout(small); });
        expect(result.current.importError).toBe('Choose a Svalboard layout with a 10 × 6 matrix');
        await act(async () => { await result.current.importLayout(new File(['not a layout'], 'x.svil')); });
        expect(result.current.importError).toBe("Couldn't read this layout");
        expect(result.current.sourceOptions.map(o => o.value)).not.toContain('import');
    });
});
