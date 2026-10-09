import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useKeyboard } from '@/contexts/KeyboardContext';
import { useLayoutSettings } from '@/contexts/LayoutSettingsContext';
import { fileService } from '@/services/file.service';
import type { KeyboardInfo } from '@/types/keyboard.types';
import example from '@/default-layouts/sval-default.svil?raw';
import { DEFAULTS, PRESETS, STORAGE_KEY, preferences, type Appearance, type Preferences } from './core';
import type { SurfaceKey } from './OverlaySurface';
import { useHost } from './host';
import { surfaceKeys } from './useSurfaceKeys';
import { layerColors } from '@/utils/colors';
import type { PreviewBackground } from './preview-backgrounds';

// Overlay's state and effects, lifted unchanged from the former TrainerPage.tsx:19-106 (docs/practice/
// spec.md §1.4 item 5, §4.1 Mounting). OverlayEngine runs this hook once Overlay is first opened and
// publishes the result; the page (OverlayWorkspace) and the panel (OverlayPanel) are separate React
// trees and both read it. Nothing here runs before that first visit, so Keybard never contacts
// Keybard Host before Overlay is opened.

export type LayoutSource = 'live' | 'snapshot' | 'draft' | 'example' | 'import';
export type OverlayTile = 'Window' | 'Appearance' | 'Feedback' | 'Recall';

export interface LayoutSourceOption {
    value: LayoutSource;
    /** The option's name, also the preview footer's source. */
    label: string;
    /** "· read-only" or "· unsaved changes", printed after the name in the select only. */
    suffix?: string;
    /** The suffix is the pending role's text form (Editor draft with unsaved changes). */
    pending?: boolean;
}

export interface LayerOption { index: number; label: string; color: string }

function readPreferences() { try { return preferences(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')); } catch { return preferences(null); } }

/**
 * Names the loaded snapshot after where it came from (§5.14 Layout row): "Connected board" only while
 * a board is connected; otherwise the file name, "QWERTY example (demo)", or "Loaded layout".
 */
export function snapshotName(isConnected: boolean, loadedFrom: string | null, hasSnapshot: boolean): string {
    if (!hasSnapshot) return 'QWERTY example';
    if (isConnected) return 'Connected board';
    return loadedFrom || 'Loaded layout';
}

const LAYER_PALETTE: Record<string, string> = Object.fromEntries(layerColors.map(c => [c.name, c.hex]));

/** "0 · Base" for each layer of a board, with its layer color (a named layer color or a hex; user data). */
export function layerOptions(board: KeyboardInfo): LayerOption[] {
    return (board.keymap ?? []).map((_, i) => {
        const raw = board.cosmetic?.layer_colors?.[String(i)] || 'green';
        return { index: i, label: `${i} · ${board.cosmetic?.layer?.[String(i)] || `Layer ${i}`}`, color: raw.startsWith('#') ? raw : LAYER_PALETTE[raw] || LAYER_PALETTE.green };
    });
}

export function useOverlayController(active: boolean) {
    const host = useHost();
    const { internationalLayout } = useLayoutSettings();
    const [live, setLive] = useState(true);
    const [hostDirty, setHostDirty] = useState(false);
    const { keyboard, originalKeyboard, hasUnsavedChanges, isConnected, loadedFrom } = useKeyboard();
    const [sample] = useState(() => fileService.parseContent(example));
    const [imported, setImported] = useState<KeyboardInfo | null>(null);
    const [source, setSource] = useState<Exclude<LayoutSource, 'live'>>('snapshot');
    const following = !!host.state && live;
    const board = following ? host.state!.board || sample : source === 'example' ? sample : source === 'import' ? imported || sample : source === 'draft' ? keyboard || sample : originalKeyboard || sample;
    const [prefs, setPrefs] = useState<Preferences>(readPreferences);
    const prefsRef = useRef(prefs); prefsRef.current = prefs;
    const [storageError, setStorageError] = useState(false);
    const [importError, setImportError] = useState('');
    // Session-only view state: the panel tile and the preview background (§5.15 Tiles, N-16).
    const [tile, setTile] = useState<OverlayTile>('Appearance');
    const [background, setBackground] = useState<PreviewBackground>('Dark');
    const [layer, setLayer] = useState(0), [base, setBase] = useState(0);
    const [held, setHeld] = useState<Set<number>>(new Set());
    const [changed, setChanged] = useState<Set<number>>(new Set());
    const [recall, setRecallState] = useState(false), [revealed, setRevealed] = useState(false);
    const [cue, setCue] = useState(0), [attempts, setAttempts] = useState(0), [correct, setCorrect] = useState(0);
    const [familiar, setFamiliar] = useState<Set<string>>(new Set()), [hideFamiliar, setHideFamiliar] = useState(false);
    const [selected, setSelected] = useState<number | null>(null);
    // Highlight held keys chosen while another Host write is in flight; sent once Host is free.
    const [pendingHighlight, setPendingHighlight] = useState<boolean | null>(null);
    const importGeneration = useRef(0);
    useEffect(() => () => { importGeneration.current++; }, []);
    useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); setStorageError(false); } catch { setStorageError(true); } }, [prefs]);
    // A new board starts the preview layers, the Recall card and the familiar bindings over.
    useEffect(() => { setLayer(0); setBase(0); setCue(0); setRevealed(false); setFamiliar(new Set()); setSelected(null); setAttempts(0); setCorrect(0); }, [board]);
    // Host config mirroring: adopt Host's config on a new revision when nothing is pending; write local
    // changes 160 ms after the last one; follow Keybard's international layout.
    useEffect(() => {
        if (host.state && !hostDirty && !host.busy) setPrefs(preferences(host.state.config));
    }, [host.state?.revision, hostDirty, host.busy]);
    useEffect(() => {
        if (!host.state || !hostDirty || host.busy) return;
        const timer = setTimeout(() => {
            void host.configure({ ...host.state!.config, ...prefs }).then(ok => { if (!ok || prefsRef.current === prefs) setHostDirty(false); });
        }, 160);
        return () => clearTimeout(timer);
    }, [prefs, hostDirty, host.busy, host.configure]);
    useEffect(() => {
        if (!host.state || host.state.config.layoutId === internationalLayout) return;
        setPrefs(p => ({ ...p, layoutId: internationalLayout }));
        setHostDirty(true);
    }, [internationalLayout, host.state?.session]);
    const keys = useMemo<SurfaceKey[]>(() => {
        if (following) {
            if (!host.state?.board || !host.state.valid) return [];
            try { return surfaceKeys(host.state.board, host.state.active, host.state.default ?? host.state.config.manualDefault, prefs.hands, internationalLayout); }
            catch { return []; }
        }
        return surfaceKeys(board, 1 << Math.min(layer, (board.keymap?.length || 1) - 1),
            1 << Math.min(base, (board.keymap?.length || 1) - 1), prefs.hands, internationalLayout);
    }, [board, layer, base, prefs.hands, internationalLayout, following, host.state?.valid, host.state?.active, host.state?.default, host.state?.config.manualDefault]);
    const previous = useRef<SurfaceKey[]>([]);
    useEffect(() => {
        const before = new Map(previous.current.map(k => [k.id, `${k.code}:${k.layer}`]));
        setChanged(new Set(keys.filter(k => before.has(k.id) && before.get(k.id) !== `${k.code}:${k.layer}`).map(k => k.id)));
        previous.current = keys;
        setRevealed(false); setHeld(new Set());
        const timer = window.setTimeout(() => setChanged(new Set()), prefs.duration);
        return () => clearTimeout(timer);
    }, [keys, prefs.duration]);
    useEffect(() => { if (!held.size) return; const timer = setTimeout(() => setHeld(new Set()), 800); return () => clearTimeout(timer); }, [held]);
    useEffect(() => {
        if (pendingHighlight === null || !host.state || host.busy) return;
        if (host.state.config.highlightPressed === pendingHighlight) { setPendingHighlight(null); return; }
        void host.configure({ ...host.state.config, highlightPressed: pendingHighlight }).then(ok => { if (ok) setPendingHighlight(null); });
    }, [pendingHighlight, host.busy, host.state?.config.highlightPressed]);
    const learnable = useMemo(() => keys.filter(k => k.code > 1), [keys]);
    const target = learnable.length ? learnable[cue % learnable.length] : undefined;
    const hidden = useMemo(() => new Set(keys.filter(k => (recall && !revealed) || (hideFamiliar && familiar.has(`${k.id}:${k.code}`) && !revealed)).map(k => k.id)),
        [keys, recall, revealed, hideFamiliar, familiar]);
    const practiceHidden = following ? [...hidden].sort((a, b) => a - b).join(',') : '';
    const practiceTarget = following && recall && revealed ? target?.id ?? null : null;
    // Recall publishes the hidden legends and the target to Host every second while the Overlay
    // workspace is showing (whether or not its panel is open), and clears them on leave.
    useEffect(() => {
        if (!host.state || !active) return;
        const publish = () => void host.command({ op: 'practice', hidden: practiceHidden ? practiceHidden.split(',').map(Number) : [], target: practiceTarget });
        publish(); const timer = setInterval(publish, 1000);
        return () => { clearInterval(timer); void host.command({ op: 'practice', hidden: [], target: null }); };
    }, [practiceHidden, practiceTarget, host.command, !!host.state, active]);

    const chosen = keys.find(k => k.id === selected);
    const appearance = prefs.appearance;
    const preset = useMemo(() => Object.entries(PRESETS).find(([, a]) => JSON.stringify(a) === JSON.stringify(appearance))?.[0] || 'Custom', [appearance]);
    const update = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => { setHostDirty(true); setPrefs(p => ({ ...p, [key]: value })); }, []);
    const setAppearance = useCallback(<K extends keyof Appearance>(key: K, value: Appearance[K]) => {
        setHostDirty(true); setPrefs(p => ({ ...p, appearance: { ...p.appearance, [key]: value } }));
    }, []);
    const applyPreset = useCallback((name: string) => { if (PRESETS[name]) update('appearance', { ...PRESETS[name] }); }, [update]);
    const resetPreferences = useCallback(() => { setHostDirty(true); setPrefs(preferences(DEFAULTS)); }, []);
    const grade = (remembered: boolean) => { if (!revealed || !target) return; setAttempts(n => n + 1); if (remembered) setCorrect(n => n + 1); setCue(n => n + 1); setRevealed(false); };
    const setRecall = (value: boolean) => { setRecallState(value); setRevealed(false); };
    const markFamiliar = () => { if (chosen && chosen.code > 1) setFamiliar(s => new Set([...s, `${chosen.id}:${chosen.code}`])); };
    const previewHeld = () => setHeld(new Set(keys.slice(8, 11).map(k => k.id)));
    const chooseSource = (value: LayoutSource) => { setLive(value === 'live'); if (value !== 'live') setSource(value); };
    /** Choosing a board on the Host card sends `connect` and follows it again, as before. */
    const connectBoard = (id: string) => { setLive(true); void host.command({ op: 'connect', id }); };
    const setHighlightPressed = (value: boolean) => { if (host.state) setPendingHighlight(value); };
    const setManualDefault = (layerIndex: number) => { if (host.state) void host.configure({ ...host.state.config, manualDefault: (1 << layerIndex) >>> 0 }); };

    async function importLayout(file: File | undefined) {
        if (!file) return;
        const generation = ++importGeneration.current;
        let loaded: KeyboardInfo;
        try { loaded = await fileService.loadFile(file); }
        catch { if (generation === importGeneration.current) setImportError("Couldn't read this layout"); return; }
        if (generation !== importGeneration.current) return;
        if (loaded.rows !== 10 || loaded.cols !== 6 || !loaded.keymap?.length) { setImportError('Choose a Svalboard layout with a 10 × 6 matrix'); return; }
        setImported(loaded); setLive(false); setSource('import'); setImportError('');
    }

    const snapshot = snapshotName(isConnected, loadedFrom, !!originalKeyboard);
    const sourceOptions: LayoutSourceOption[] = [
        ...(host.state ? [{ value: 'live' as const, label: 'Live board', suffix: '· read-only' }] : []),
        { value: 'snapshot', label: snapshot },
        ...(keyboard ? [{ value: 'draft' as const, label: 'Editor draft', ...(hasUnsavedChanges ? { suffix: '· unsaved changes', pending: true } : {}) }] : []),
        { value: 'example', label: 'QWERTY example' },
        ...(imported ? [{ value: 'import' as const, label: 'Imported layout' }] : []),
    ];
    const sourceValue: LayoutSource = following ? 'live' : source;
    const noBoard = following && !host.state!.selectedDevice;
    const sourceName = noBoard ? 'No board' : sourceOptions.find(o => o.value === sourceValue)?.label ?? snapshot;

    const pressed = host.state?.pressed;
    const hostHeld = useMemo(() => new Set(pressed || []), [pressed]);
    const layers = useMemo(() => layerOptions(board), [board]);
    // Desktop default layer is a Host-wide setting, so it lists the board Host reads, not the preview's.
    const hostBoard = host.state?.board;
    const hostLayers = useMemo(() => hostBoard ? layerOptions(hostBoard) : layers, [hostBoard, layers]);

    return {
        host, following, board, keys, changed,
        held: following ? hostHeld : held,
        hidden, target, revealed, recall, attempts, correct, learnable, selected, chosen, familiar, hideFamiliar,
        prefs, appearance, preset, storageError,
        /** A Host write is pending or in flight (§5.15 footer). */
        saving: !!host.state && (hostDirty || host.busy),
        tile, background, layer, base, importError,
        sourceOptions, sourceValue, sourceName, noBoard,
        layers, hostLayers,
        /** Highlight held keys as shown: a choice waiting for Host, else Host's config. */
        highlightPressed: pendingHighlight ?? !!host.state?.config.highlightPressed,
        setTile, setBackground, setLayer, setBase, setSelected, setHideFamiliar, setRecall,
        update, setAppearance, applyPreset, resetPreferences, grade, reveal: () => setRevealed(true), markFamiliar,
        clearFamiliar: () => setFamiliar(new Set()), previewHeld, chooseSource, importLayout, connectBoard,
        setHighlightPressed, setManualDefault,
    };
}

export type OverlayModel = ReturnType<typeof useOverlayController>;
