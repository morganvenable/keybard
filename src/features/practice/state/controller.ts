// Practice's controller (spec §4.1 Mounting, §5.2–§5.5, §5.9): the state behind
// the Lessons and Progress pages and the Lesson and Progress panels.
//
// A plain class, so its rules can be tested without React. PracticeEngine feeds
// it the keymap and the workspace state (usePracticeController) and publishes it;
// the pages and panels read it and call its methods. It never reads the board
// itself: PracticeEngineHost attaches a LiveInput (input/liveInput.ts), and the
// controller decides when it reads (the §3.2 input mode) and feeds it keystrokes.
//
// What it decides:
// - loading: the store (IndexedDB, or memory with a Storage off notice), the
//   English content, and the active profile's results;
// - the session (state/session.ts): rebuilt when the keymap fingerprint, the
//   profile or a lesson-shaping setting changes (sliders debounced 300 ms). A
//   rebuild on the same keymap and history starts from the current key stats; a
//   long replay runs in chunks that yield, the old session staying (paused) until
//   it is done; a rebuild asked for while a lesson is being saved waits for it;
// - the lesson: a LessonRun, paused on blur, Esc, a hidden tab, leaving the page
//   or 10 s idle; kept 10 minutes while paused, then replaced;
// - the status slot: one notice or banner at a time, by the §5.2 priority;
// - Live · USB (§3.2, §9.3): the input mode, reading only while it is Live · USB
//   and the lesson isn't paused, attribution of each keystroke, and Layer locked on.
import { OWNER_Q4_PARANOID_READS_KEYS, OWNER_Q11_CAPS_LOCK_OUTRANKS_STORAGE, OWNER_Q12_LAYER_LOCK_DROPS_KEYSTROKES } from '@/constants/owner-decisions';
import { PARANOID } from '@/lib/paranoid';
import type { PracticeContent } from '../content/loader';
import { type InputConditions, type InputMode, inputMode, liveAvailability } from '../input/inputMode';
import type { LiveInput } from '../input/liveInput';
import type { PracticeStore, StoredResult } from '../store/db';
import { loadEvents } from '../store/events';
import { type EventStats, EventStatsCache } from './eventStats';
import { exportProfile, ImportError, type ImportMode, importIntoProfile, type ImportSummary } from '../store/export';
import { boardIdentity, newProfile, profileIdFor } from '../store/profiles';
import type { ProfileRecord, SnapshotRecord } from '../types';
import { type IInputEvent, type IKeyboardEvent } from '../vendor/keybr/textinput-events/index.ts';
import type { LessonRun } from './lessonRun';
import { type Completion, type LessonEvent, loadProfileData, PracticeSession, type PracticeKeymap, type ProfileData, resolvePracticeKeymap } from './session';
import { clusterScope, drillTarget } from '../lessons/scope';
import { type DrillSettings, LESSON_SHAPING, type PracticeSettings, START_PRESETS, type StartPreset } from './settings';
import type { KeyboardInfo } from '@/types/keyboard.types';
import { LAYOUTS } from '@/components/Keyboards/layouts';

export type KeymapSourceKind = 'connected' | 'file' | 'example';

/** The keymap Practice follows, as the editor's contexts describe it (§5.4). */
export interface KeymapInput {
    /** The practiced keymap: what the board runs (originalKeyboard) when connected, else the loaded draft. */
    board: KeyboardInfo;
    source: KeymapSourceKind;
    /** File name or device name, for the Keymap rows. */
    sourceLabel: string;
    layoutId: string;
    defaultLayer: number;
    /** A board is connected over WebHID. */
    connected: boolean;
    /** Connected with Live Updating off and edits not yet sent (§5.3 Unsent changes). */
    unsentChanges: boolean;
    /** navigator.hid exists. */
    hidSupported: boolean;
}

export const SOURCE_NAMES: Record<KeymapSourceKind, string> = {
    connected: 'Connected board',
    file: 'Loaded file',
    example: 'QWERTY example',
};

/** Status slot items, highest priority first (§5.2). OS layout mismatch and Layer locked on are live only. */
export const SPEC_STATUS_PRIORITY = [
    'storage-off', 'newer-schema', 'os-mismatch', 'caps-lock', 'layer-locked', 'keymap-changed',
    'unsent-changes', 'board-connected', 'new-key', 'daily-goal', 'top-speed',
] as const;
export type StatusId = (typeof SPEC_STATUS_PRIORITY)[number];

/**
 * The priority in use. Storage off and Newer schema never clear in a session, so
 * under the spec's order they would hide Caps Lock is on for good while it drops
 * every keystroke (a private window, say). OWNER_Q11 moves Caps Lock above them.
 */
export const STATUS_PRIORITY: readonly StatusId[] = OWNER_Q11_CAPS_LOCK_OUTRANKS_STORAGE
    ? ['caps-lock', ...SPEC_STATUS_PRIORITY.filter((id) => id !== 'caps-lock')]
    : SPEC_STATUS_PRIORITY;

export type StatusItem =
    | { id: Exclude<StatusId, 'new-key' | 'daily-goal' | 'top-speed' | 'os-mismatch'>; kind: 'notice'; text: string }
    /** OS layout mismatch (§5.3): the notice carries a select of Keybard's OS layouts, at the current one. */
    | { id: 'os-mismatch'; kind: 'notice'; text: string; layoutId: string }
    | { id: 'new-key'; kind: 'banner'; codePoint: number }
    | { id: 'top-speed'; kind: 'banner'; speed: number }
    | { id: 'daily-goal'; kind: 'banner'; minutes: number };

export const NOTICE_TEXT = {
    'storage-off': "Progress isn't being saved",
    'newer-schema': 'Progress was saved by a newer Keybard',
    'caps-lock': 'Caps Lock is on',
    'keymap-changed': 'Keymap changed · lesson restarted',
    'unsent-changes': "Practicing the board's keymap · unsent edits excluded",
    'board-connected': 'Board connected · lesson restarted',
} as const;

/** An OS layout's short name for the mismatch notice: "US" for English (US), else Keybard's label. */
export function osLayoutName(layoutId: string): string {
    const label = LAYOUTS[layoutId]?.label ?? layoutId;
    return /^English \((.+)\)$/.exec(label)?.[1] ?? label;
}

/** "Typed characters don't match US layout" (§5.3 OS layout mismatch). */
export function osMismatchText(layoutId: string): string {
    return `Typed characters don't match ${osLayoutName(layoutId)} layout`;
}

/** How long the Keymap changed and Board connected notices stay (§5.3). */
export const TRANSIENT_NOTICE_MS = 4000;
/** Typing pauses after this long without a keystroke (§5.3). */
export const IDLE_PAUSE_MS = 10_000;
/** A paused lesson is kept this long, then replaced (§4.4). */
export const PAUSED_LESSON_KEEP_MS = 10 * 60_000;
/** Slider changes that shape the lesson regenerate it after this pause (§5.5). */
export const SETTINGS_DEBOUNCE_MS = 300;

export type LoadState = 'loading' | 'content-error' | 'ready';

export interface ControllerDeps {
    loadSettings: () => PracticeSettings;
    saveSettings: (settings: PracticeSettings) => boolean;
    openStore: () => Promise<{ store: PracticeStore; persistent: boolean }>;
    loadContent: () => Promise<PracticeContent>;
    /** Wall clock for result time stamps. */
    now?: () => number;
    /** The DOM event clock (performance.now), for pauses. */
    clock?: () => number;
    /** Resolves on a later task, between the chunks of a long history replay (§9.7). */
    yieldToBrowser?: () => Promise<void>;
}

/** A new task, unclamped where MessageChannel exists (nested setTimeout(0) waits 4 ms). */
export function nextTask(): Promise<void> {
    if (typeof MessageChannel === 'undefined') return new Promise((resolve) => setTimeout(resolve, 0));
    return new Promise((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => { channel.port1.close(); resolve(); };
        channel.port2.postMessage(null);
    });
}

/** Survives an EditorLayout remount (a board connect, §5.3): a lesson was underway in this page session. */
const pageSession = { hadLesson: false };

/** For tests: forget that a lesson was underway. */
export function resetPracticePageSession() {
    pageSession.hadLesson = false;
}

export class PracticeController {
    settings: PracticeSettings;
    loadState: LoadState = 'loading';
    store: PracticeStore | null = null;
    persistent = true;
    content: PracticeContent | null = null;
    profiles: ProfileRecord[] = [];
    session: PracticeSession | null = null;
    run: LessonRun | null = null;
    keymap: KeymapInput | null = null;
    /** Settings could not be written (panel footer). */
    settingsError = false;
    /** A lesson-shaping slider change is waiting for its debounce (panel footer Saving…). */
    saving = false;
    /** The last completed lesson could not be stored: Storage off shows until one is (§5.3). */
    storageError = false;
    /** The most recent aria-live message (§5.12). */
    announcement = '';
    /** Code point unlocked by the last lesson: its board key and strip cap pulse (§5.3). */
    justUnlocked: number | null = null;
    /** Last completion, for the metrics' delta animation. */
    lastCompletion: Completion | null = null;
    /** A Lesson panel section to scroll to when the panel next shows (the type row's scope button). */
    panelSection: string | null = null;
    /** Live · USB: the sampler and correlator, attached by PracticeEngineHost (null in Keymap-only setups). */
    live: LiveInput | null = null;
    version = 0;

    readonly #deps: Required<ControllerDeps>;
    readonly #listeners = new Set<() => void>();
    #profileData: ProfileData | null = null;
    #snapshot: SnapshotRecord | undefined;
    #resolved: { resolution: Awaited<ReturnType<typeof resolvePracticeKeymap>>['resolution']; fingerprint: string; keymap: PracticeKeymap } | null = null;
    #keymapSeq = 0;
    #profileSeq = 0;
    #active = false;
    #focused = false;
    #visible = true;
    #emitQueued = false;
    #banner: Extract<StatusItem, { kind: 'banner' }> | null = null;
    #transient = new Map<StatusId, number>();
    #timers = new Set<ReturnType<typeof setTimeout>>();
    #idleTimer: ReturnType<typeof setTimeout> | null = null;
    #rebuildTimer: ReturnType<typeof setTimeout> | null = null;
    #pausedSince: number | null = null;
    #completing = false;
    /** A rebuild was asked for while a lesson was being saved; it runs after the save (§5.3). */
    #rebuildAfterComplete = false;
    /** A deferred history replay is running; #buildSeq tells a stale one to stop. */
    #building = false;
    #buildSeq = 0;
    #disposed = false;
    #started = false;
    #eventStats: EventStatsCache | null = null;

    constructor(deps: ControllerDeps) {
        this.#deps = {
            now: () => Date.now(),
            clock: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
            yieldToBrowser: nextTask,
            ...deps,
        };
        this.settings = deps.loadSettings();
    }

    // ---- subscription

    subscribe = (listener: () => void) => {
        this.#listeners.add(listener);
        return () => { this.#listeners.delete(listener); };
    };

    getVersion = () => this.version;

    #emit() {
        if (this.#disposed) return;
        this.#syncLive();
        this.version++;
        for (const listener of [...this.#listeners]) listener();
    }

    /** An emit from LiveInput's callbacks, outside whatever call is running. */
    #emitSoon() {
        if (this.#emitQueued) return;
        this.#emitQueued = true;
        queueMicrotask(() => {
            this.#emitQueued = false;
            this.#emit();
        });
    }

    #later(ms: number, run: () => void) {
        const timer = setTimeout(() => { this.#timers.delete(timer); if (!this.#disposed) run(); }, ms);
        this.#timers.add(timer);
        return timer;
    }

    dispose() {
        this.#disposed = true;
        for (const timer of this.#timers) clearTimeout(timer);
        this.#timers.clear();
        if (this.#idleTimer) clearTimeout(this.#idleTimer);
        if (this.#rebuildTimer) clearTimeout(this.#rebuildTimer);
        if (this.run?.started && !this.run.textInput.completed) pageSession.hadLesson = true;
        this.attachLive(null);
    }

    // ---- Live · USB (§3.2, §9.3)

    /** Attaches (or detaches) the board reader. PracticeEngineHost owns it. */
    attachLive(live: LiveInput | null) {
        if (live === this.live) return;
        if (this.live) {
            this.live.onChange = null;
            this.live.setWanted(false);
            this.live.bindRun(null);
        }
        this.live = live;
        if (!live) return;
        live.onChange = () => this.#emitSoon();
        this.#liveKeymap();
        live.bindRun(this.run);
        this.#emit();
    }

    #liveKeymap() {
        const resolved = this.#resolved;
        if (!this.live || !resolved) return;
        const board = resolved.keymap.board;
        this.live.setKeymap({ resolution: resolved.resolution, keymap: board.keymap ?? [], rows: board.rows, cols: board.cols });
    }

    get inputConditions(): InputConditions {
        const k = this.keymap;
        return {
            hidSupported: !!k?.hidSupported,
            connected: !!k?.connected,
            connectedSource: k?.source === 'connected',
            readKeyPresses: this.settings.readKeyPresses,
            paranoid: PARANOID,
            paranoidReads: OWNER_Q4_PARANOID_READS_KEYS,
            sampler: !!this.live,
            failed: !!this.live?.failed,
            focused: this.#focused,
            visible: this.#visible,
            active: this.#active,
        };
    }

    /** Live · USB is available: the P4 rows say Shown and Live, whatever the focus (§5.6). */
    get liveAvailable(): boolean {
        return liveAvailability(this.inputConditions).available;
    }

    /** P4 Pressed keys value (§5.6). */
    get pressedKeysValue(): string {
        return liveAvailability(this.inputConditions).pressedKeys;
    }

    /** The §3.2 input mode. The pill shows Paused instead while the lesson is paused. */
    get inputMode(): InputMode {
        return inputMode(this.inputConditions);
    }

    /**
     * OS layout mismatch (§3.1, §5.3): at least 5 of the last 20 eligible steps typed something other
     * than the key pressed. It needs Live · USB to be available, not the focus: choosing a layout in the
     * notice's select blurs the text, and the notice must stay until the new layout restarts the lesson.
     */
    get osMismatch(): boolean {
        return this.liveAvailable && !!this.live?.mismatch.triggered;
    }

    /** Layer locked on (§5.3): the layer, while Live · USB sees it. */
    get layerLocked(): number | null {
        return this.inputMode === 'usb' ? this.live?.layerLocked ?? null : null;
    }

    /**
     * Reads the board only in Live · USB with a lesson that isn't paused (§9.3 Lifecycle, D10). A board
     * that stopped answering shows Keymap only but is still asked every 2 s, so it can come back (§9.3 Errors).
     */
    #syncLive() {
        const live = this.live;
        if (!live) return;
        const run = this.run;
        const lesson = !!run && (run.phase === 'ready' || run.phase === 'typing' || this.#completing);
        live.setWanted(!this.#disposed && lesson && inputMode({ ...this.inputConditions, failed: false }) === 'usb');
    }

    // ---- loading

    /** Opens the store and loads the content and the active profile. Safe to call again after a content error. */
    async start(): Promise<void> {
        if (this.#started && this.loadState !== 'content-error') return;
        this.#started = true;
        this.loadState = 'loading';
        this.#emit();
        if (!this.store) {
            const { store, persistent } = await this.#deps.openStore();
            if (this.#disposed) return;
            this.store = store;
            this.persistent = persistent;
            await this.#loadProfile();
        }
        try {
            this.content = await this.#deps.loadContent();
        } catch {
            if (this.#disposed) return;
            this.loadState = 'content-error';
            this.#emit();
            return;
        }
        if (this.#disposed) return;
        this.loadState = 'ready';
        this.#rebuild();
    }

    /** Retry after "Practice words didn't load" (§5.3). */
    retry() {
        void this.start();
    }

    async #loadProfile() {
        const store = this.store;
        if (!store) return;
        const seq = ++this.#profileSeq;
        try {
            const data = await loadProfileData(store, this.settings);
            const snapshot = await store.getSnapshot(data.profile.id).catch(() => undefined);
            const profiles = await store.listProfiles();
            if (seq !== this.#profileSeq || this.#disposed) return;
            this.#profileData = data;
            this.#snapshot = snapshot;
            this.profiles = profiles.sort((a, b) => a.createdAt - b.createdAt || a.name.localeCompare(b.name));
            if (this.settings.activeProfileId !== data.profile.id) this.#write({ ...this.settings, activeProfileId: data.profile.id });
        } catch {
            // A failing store read: carry on with an empty in-memory profile.
            if (seq !== this.#profileSeq) return;
            this.#profileData = { profile: newProfile('me', 'Me'), records: [], newerSchema: false };
        }
    }

    // ---- keymap

    /** The keymap and its context changed (§5.4). Resolving is async (the fingerprint hashes). */
    setKeymap(input: KeymapInput) {
        const previous = this.keymap;
        this.keymap = input;
        const same = previous && previous.board.keymap === input.board.keymap && previous.layoutId === input.layoutId
            && previous.defaultLayer === input.defaultLayer && previous.board.keylayout === input.board.keylayout
            && previous.board.combos === input.board.combos && previous.board.tapdances === input.board.tapdances
            && previous.board.key_overrides === input.board.key_overrides;
        if (same) {
            if (previous.unsentChanges !== input.unsentChanges || previous.source !== input.source || previous.sourceLabel !== input.sourceLabel
                || previous.connected !== input.connected || previous.hidSupported !== input.hidSupported) this.#emit();
            return;
        }
        const seq = ++this.#keymapSeq;
        const keymap: PracticeKeymap = { board: input.board, layoutId: input.layoutId, defaultLayer: input.defaultLayer };
        void resolvePracticeKeymap(keymap).then(({ resolution, fingerprint }) => {
            if (seq !== this.#keymapSeq || this.#disposed) return;
            const changed = this.#resolved && this.#resolved.fingerprint !== fingerprint;
            const first = !this.#resolved;
            this.#resolved = { resolution, fingerprint, keymap };
            this.#liveKeymap();
            // Same paths (a layer color or a layer name changed, say): keep the lesson, redraw.
            if (!first && !changed) { this.#emit(); return; }
            if (changed && this.session) this.#notify('keymap-changed');
            this.#rebuild();
        });
    }

    get sourceName(): string {
        return this.keymap ? SOURCE_NAMES[this.keymap.source] : '';
    }

    /** x.board for results (§8.1). */
    get boardId(): string {
        const k = this.keymap;
        if (!k) return 'unknown';
        if (k.source === 'example') return 'example';
        return boardIdentity(k.source === 'connected' ? { kind: 'connected', kbid: k.board.kbid } : { kind: 'file', kbid: k.board.kbid });
    }

    // ---- session

    /** A history replay is running in chunks (§9.7); the old session shows, paused, until it ends. */
    get building(): boolean {
        return this.#building;
    }

    #rebuild() {
        if (this.#rebuildTimer) { clearTimeout(this.#rebuildTimer); this.#rebuildTimer = null; }
        this.saving = false;
        // The finishing lesson is about to join the history: build once it has (§5.3).
        if (this.#completing) {
            this.#rebuildAfterComplete = true;
            this.#emit();
            return;
        }
        const resolved = this.#resolved;
        const data = this.#profileData;
        if (this.loadState !== 'ready' || !this.store || !this.content || !data || !resolved) {
            this.#emit();
            return;
        }
        const seq = ++this.#buildSeq;
        // The stored snapshot speeds up a profile's first build. Later, the same history on
        // the same keymap starts from the current key stats; anything else replays (§6.8).
        let snapshot = this.#snapshot;
        this.#snapshot = undefined;
        const current = this.session;
        if (!snapshot && current?.seeded && current.data === data && current.fingerprint === resolved.fingerprint
            && current.results.length === data.records.length) {
            snapshot = current.progress.snapshot(data.profile.id, resolved.fingerprint);
        }
        const session = new PracticeSession(this.store, this.persistent, this.content, resolved.keymap, resolved.resolution,
            resolved.fingerprint, this.settings, data, snapshot, { deferSeed: true });
        if (session.seeded) {
            this.#building = false;
            this.#install(session);
            return;
        }
        this.#building = true;
        this.#pause();
        this.#emit();
        const live = () => seq === this.#buildSeq && !this.#disposed;
        void session.seed(this.#deps.yieldToBrowser, live).then((done) => {
            if (!done || !live()) return;
            this.#building = false;
            this.#install(session);
        });
    }

    #install(session: PracticeSession) {
        const hadLesson = pageSession.hadLesson;
        pageSession.hadLesson = false;
        this.session = session;
        if (hadLesson && this.keymap?.connected) this.#notify('board-connected');
        this.#newRun();
    }

    #newRun() {
        const session = this.session;
        this.#clearIdle();
        this.#pausedSince = null;
        if (!session || session.noLesson || session.firstRun) {
            this.run = null;
            this.live?.bindRun(null);
            this.#emit();
            return;
        }
        this.run = session.newRun();
        this.live?.bindRun(this.run);
        if (!this.#focused || !this.#active || !this.#visible) this.#pause();
        this.#emit();
    }

    /** Discards the current lesson and starts a new one (Restart lesson, the type control). */
    regenerate() {
        this.#newRun();
    }

    /**
     * Drill this key (P5, §5.7): Drill with the character and its cluster neighbors in
     * scope and the character focused. The caller shows the Lessons page.
     */
    drillKey(codePoint: number) {
        const session = this.session;
        if (!session) return;
        const letterFrequency = new Map(session.languageLetters.map((l) => [l.codePoint, l.f]));
        const target = drillTarget(session.resolution, codePoint, letterFrequency);
        if (target == null) return;
        const keys = clusterScope(session.resolution, target, session.keymap.board.cols, letterFrequency);
        this.update({ type: 'drill', drill: { ...this.settings.drill, keys, focus: target, name: null } });
    }

    /**
     * Drill this group (P5 aggregate, §5.7): Drill with the group's characters (all layers) in scope; the focus
     * is the group's weakest, which Drill picks when none is chosen. The caller shows the Lessons page.
     */
    drillGroup(codePoints: readonly number[], name: string) {
        const session = this.session;
        if (!session) return;
        const keys = this.drillableOf(codePoints);
        if (!keys.length) return;
        this.update({ type: 'drill', drill: { ...this.settings.drill, keys, focus: null, name } });
    }

    /** The characters of a group Drill can drill (§5.7): each one's drill target, once. */
    drillableOf(codePoints: readonly number[]): number[] {
        const session = this.session;
        if (!session) return [];
        const letterFrequency = new Map(session.languageLetters.map((l) => [l.codePoint, l.f]));
        const out = new Set<number>();
        for (const c of codePoints) {
            const target = drillTarget(session.resolution, c, letterFrequency);
            if (target != null) out.add(target);
        }
        return [...out];
    }

    /** Whether Drill this key has something to drill for the character (§5.7): not Space or Enter. */
    canDrillKey(codePoint: number): boolean {
        const session = this.session;
        if (!session) return false;
        const letterFrequency = new Map(session.languageLetters.map((l) => [l.codePoint, l.f]));
        return drillTarget(session.resolution, codePoint, letterFrequency) != null;
    }

    /** Changes the Drill scope from the Lesson panel; Drill this key's explicit set ends (§5.5). */
    updateDrill(patch: Partial<Omit<DrillSettings, 'keys' | 'focus'>>, options?: { debounce?: boolean }) {
        this.update({ drill: { ...this.settings.drill, ...patch, keys: null, focus: null, name: null } }, options);
    }

    // ---- settings

    /**
     * Changes settings. A lesson-shaping change rebuilds the session and the
     * lesson (debounced for sliders); display settings apply at once (§5.5).
     */
    update(patch: Partial<PracticeSettings>, { debounce = false }: { debounce?: boolean } = {}) {
        const previous = this.settings;
        const next = { ...previous, ...patch };
        this.#write(next);
        if (next.activeProfileId !== previous.activeProfileId) {
            void this.#loadProfile().then(() => this.#rebuild());
            return;
        }
        const shaping = LESSON_SHAPING.some((key) => JSON.stringify(next[key]) !== JSON.stringify(previous[key]));
        if (!shaping) {
            this.#emit();
            return;
        }
        if (this.#rebuildTimer) clearTimeout(this.#rebuildTimer);
        if (debounce) {
            this.saving = true;
            this.#rebuildTimer = setTimeout(() => { this.#rebuildTimer = null; if (!this.#disposed) this.#rebuild(); }, SETTINGS_DEBOUNCE_MS);
            this.#emit();
        } else {
            this.#rebuild();
        }
    }

    #write(next: PracticeSettings) {
        this.settings = next;
        this.settingsError = !this.#deps.saveSettings(next);
    }

    // ---- Start (P2) and profiles

    /** Applies a Start preset with the chosen target and leaves first run (§5.4). */
    async startPractice(preset: StartPreset, targetSpeed: number) {
        const session = this.session;
        if (!session) return;
        await session.completeStart();
        this.update({ ...START_PRESETS[preset], targetSpeed });
        // A preset that matches the current settings shapes nothing: start the lesson anyway.
        if (this.session === session) this.#newRun();
    }

    selectProfile(id: string) {
        if (id !== this.settings.activeProfileId) this.update({ activeProfileId: id });
    }

    async createProfile(name: string): Promise<ProfileRecord | null> {
        const store = this.store;
        const trimmed = name.trim();
        if (!store || !trimmed) return null;
        const profile = newProfile(profileIdFor(trimmed, this.profiles.map((p) => p.id)), trimmed, this.#deps.now());
        try {
            await store.putProfile(profile);
        } catch {
            return null;
        }
        this.profiles = [...this.profiles, profile];
        this.selectProfile(profile.id);
        return profile;
    }

    /**
     * P5's Pressed instead and layer reach for these lessons (§5.7), from their stored events. Each lesson
     * is read once; an empty map without a store.
     */
    eventStats(records: readonly StoredResult[]): Promise<EventStats> {
        const store = this.store;
        if (!store) return Promise.resolve(new Map());
        this.#eventStats ??= new EventStatsCache((id) => loadEvents(store, id));
        return this.#eventStats.statsFor(records);
    }

    // ---- data (§5.9 Data, §8.4)

    /**
     * Import and Reset need persistent storage that this build may write: with Storage off they would act on
     * this session's memory only, and a newer schema makes Practice read-only (§8.6). Export always works.
     */
    get dataWritable(): boolean {
        return !this.storageOff && !this.session?.readOnly;
    }

    /** The export file of the active profile (§8.4): `keybard-practice-<profile>-<yyyy-mm-dd>.json`. */
    async exportData(includeKeystrokes = this.settings.exportKeystrokes): Promise<{ filename: string; text: string }> {
        const store = this.store;
        const profile = this.session?.profile ?? this.#profileData?.profile;
        if (!store || !profile) throw new Error('Practice is not loaded');
        const now = new Date(this.#deps.now());
        const file = await exportProfile(store, profile.id, { includeEvents: includeKeystrokes, settings: this.settings, now });
        const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const slug = profile.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || profile.id;
        return { filename: `keybard-practice-${slug}-${day}.json`, text: JSON.stringify(file) };
    }

    /** Lessons in the active profile now (the Replace confirm's "120 lessons will be deleted"). */
    get lessonCount(): number {
        return this.session?.records.length ?? this.#profileData?.records.length ?? 0;
    }

    /** Imports a parsed file into the active profile, then reloads its history (§8.4). */
    async importData(json: unknown, mode: ImportMode): Promise<ImportSummary> {
        const store = this.store;
        const profile = this.session?.profile ?? this.#profileData?.profile;
        if (!store || !profile || !this.dataWritable) throw new ImportError('Progress is not being saved', 'format');
        const summary = await importIntoProfile(store, profile.id, json, mode);
        await this.#reloadHistory();
        return summary;
    }

    /** Deletes the active profile's results, events and snapshot (§5.9 Reset); the profile itself stays. */
    async resetProgress(): Promise<void> {
        const store = this.store;
        const profile = this.session?.profile ?? this.#profileData?.profile;
        if (!store || !profile || !this.dataWritable) return;
        await store.deleteEvents(await store.listEventIds(profile.id));
        await store.deleteResults(profile.id);
        await store.deleteSnapshot(profile.id);
        await this.#reloadHistory();
    }

    async #reloadHistory() {
        this.#eventStats?.clear();
        this.#snapshot = undefined;
        await this.#loadProfile();
        this.#rebuild();
    }

    /** Asks the Lesson panel to show a section (the type row's scope button, Change scope; §5.2). */
    requestPanelSection(section: string) {
        this.panelSection = section;
        this.#emit();
    }

    /** The Lesson panel took the request. */
    takePanelSection(): string | null {
        const section = this.panelSection;
        this.panelSection = null;
        return section;
    }

    // ---- activity, focus and pause

    /** The Lessons page is showing in the Practice workspace. Leaving it pauses (§5.3). */
    setActive(active: boolean) {
        if (active === this.#active) return;
        this.#active = active;
        if (!active) this.pause();
        this.#syncLive();
    }

    /** The tab became visible or hidden. Hidden pauses, and the board is never read while hidden (D10). */
    setVisible(visible: boolean) {
        if (visible === this.#visible) return;
        this.#visible = visible;
        if (!visible) this.pause();
        this.#emit();
    }

    get active() {
        return this.#active;
    }

    /** The typing surface gained or lost focus. Blur pauses; focus alone does not resume (§4.1). */
    setFocused(focused: boolean) {
        if (focused === this.#focused) return;
        this.#focused = focused;
        if (!focused) this.pause();
        // Reading stops on blur whether or not there was a lesson to pause (§9.3, D10).
        this.#emit();
    }

    get focused() {
        return this.#focused;
    }

    get paused(): boolean {
        return this.run?.phase === 'paused';
    }

    #pause() {
        const run = this.run;
        if (!run || run.phase === 'complete' || run.phase === 'paused') return;
        run.pause(this.#deps.clock());
        this.#pausedSince = this.#deps.now();
        this.#clearIdle();
    }

    pause() {
        if (!this.run || this.paused) return;
        this.#pause();
        if (this.run.started) this.announcement = 'Paused';
        this.#emit();
    }

    /** Resume (Enter, the Resume pill, a click on the text card). A lesson paused over 10 minutes is replaced. */
    resume() {
        const run = this.run;
        if (!run || !this.paused) return;
        if (run.started && this.#pausedSince != null && this.#deps.now() - this.#pausedSince > PAUSED_LESSON_KEEP_MS) {
            this.#focused = true;
            this.#active = true;
            this.#newRun();
            return;
        }
        run.resume(this.#deps.clock());
        this.#pausedSince = null;
        if (run.started) {
            this.announcement = 'Resumed';
            this.#armIdle();
        }
        this.#emit();
    }

    togglePause() {
        if (this.paused) this.resume();
        else this.pause();
    }

    #clearIdle() {
        if (this.#idleTimer) clearTimeout(this.#idleTimer);
        this.#idleTimer = null;
    }

    #armIdle() {
        this.#clearIdle();
        this.#idleTimer = setTimeout(() => {
            this.#idleTimer = null;
            if (!this.#disposed && this.run?.phase === 'typing') this.pause();
        }, IDLE_PAUSE_MS);
    }

    // ---- typing

    onKey(event: IKeyboardEvent) {
        if (this.run?.onKey(event)) this.#emit();
    }

    onInput(event: IInputEvent) {
        const run = this.run;
        if (!run || this.#completing) return;
        if (OWNER_Q12_LAYER_LOCK_DROPS_KEYSTROKES && this.layerLocked != null && run.phase !== 'paused') {
            // Layer locked on: dropped like Caps Lock's, with the notice showing (§5.3, OWNER_Q12).
            this.#emit();
            return;
        }
        const outcome = run.onInput(event);
        if (outcome.ignored) {
            // Caps Lock keystrokes are dropped, but the notice must show (§5.3).
            if (run.capsLock) this.#emit();
            return;
        }
        if (outcome.keystroke) this.live?.enqueue(outcome.keystroke);
        // A banner clears on the next keystroke; the slot stays, so nothing moves (§5.3).
        this.#banner = null;
        this.justUnlocked = null;
        this.#armIdle();
        if (outcome.completed) void this.#complete(run);
        this.#emit();
    }

    async #complete(run: LessonRun) {
        const session = this.session;
        if (!session || !this.keymap) return;
        this.#completing = true;
        this.#clearIdle();
        try {
            // The last keystrokes' evidence arrives up to ε after them (§9.3).
            await this.live?.settle();
            const completion = await session.complete(run, {
                ts: this.#deps.now(), src: run.observed > 0 ? 'usb' : 'keymap', board: this.boardId, os: this.keymap.layoutId,
            });
            if (this.#disposed) return;
            this.storageError = completion.storageError;
            if (this.session !== session) return;
            this.lastCompletion = completion;
            if (completion.valid) {
                const { speed, accuracy } = recordSpeed(completion);
                const said = this.settings.speedUnit === 'cpm' ? `${Math.round(speed)} characters per minute` : `${(speed / 5).toFixed(1)} words per minute`;
                this.announcement = `Lesson complete. ${said}, ${Math.floor(accuracy * 100)} percent.`;
                this.#onEvents(completion.events);
            }
        } finally {
            this.#completing = false;
        }
        // A rebuild asked for during the save, or a replay that began before this lesson
        // joined the history, builds again from the history as it is now.
        if (this.#rebuildAfterComplete || this.#building) {
            this.#rebuildAfterComplete = false;
            this.#rebuild();
        } else if (this.session === session) {
            this.#newRun();
        }
    }

    #onEvents(events: readonly LessonEvent[]) {
        // One banner at a time, by priority: New key, then Daily goal reached, then New top speed.
        const newKey = events.find((e) => e.type === 'new-key');
        const goal = events.find((e) => e.type === 'daily-goal');
        const top = events.find((e) => e.type === 'top-speed');
        if (newKey?.type === 'new-key') {
            this.#banner = { id: 'new-key', kind: 'banner', codePoint: newKey.key.letter.codePoint };
            this.justUnlocked = newKey.key.letter.codePoint;
            this.announcement += ` New key ${newKey.key.letter.label}.`;
        } else if (goal?.type === 'daily-goal') {
            this.#banner = { id: 'daily-goal', kind: 'banner', minutes: goal.minutes };
            this.announcement += ' Daily goal reached.';
        } else if (top?.type === 'top-speed') {
            this.#banner = { id: 'top-speed', kind: 'banner', speed: top.speed };
            this.announcement += ' New top speed.';
        }
    }

    // ---- status slot

    #notify(id: StatusId) {
        const until = this.#deps.now() + TRANSIENT_NOTICE_MS;
        this.#transient.set(id, until);
        this.#later(TRANSIENT_NOTICE_MS + 1, () => this.#emit());
    }

    /** Progress isn't being saved: no IndexedDB, or the last lesson's write failed (§5.3). */
    get storageOff(): boolean {
        return !!this.store && (!this.persistent || this.storageError);
    }

    /** The one item the status slot shows (§5.2 priority, as OWNER_Q11 sets it). */
    get status(): StatusItem | null {
        const now = this.#deps.now();
        const live = (id: StatusId) => (this.#transient.get(id) ?? 0) > now;
        for (const id of STATUS_PRIORITY) {
            switch (id) {
                case 'storage-off':
                    if (this.storageOff) return { id, kind: 'notice', text: NOTICE_TEXT[id] };
                    break;
                case 'newer-schema':
                    if (this.session?.readOnly) return { id, kind: 'notice', text: NOTICE_TEXT[id] };
                    break;
                case 'caps-lock':
                    if (this.run?.capsLock) return { id, kind: 'notice', text: NOTICE_TEXT[id] };
                    break;
                case 'keymap-changed':
                case 'board-connected':
                    if (live(id)) return { id, kind: 'notice', text: NOTICE_TEXT[id] };
                    break;
                case 'unsent-changes':
                    if (this.keymap?.unsentChanges) return { id, kind: 'notice', text: NOTICE_TEXT[id] };
                    break;
                case 'layer-locked': {
                    const layer = this.layerLocked;
                    if (layer != null) return { id, kind: 'notice', text: layerLockedText(this.keymap?.board, layer) };
                    break;
                }
                case 'new-key':
                case 'daily-goal':
                case 'top-speed':
                    if (this.#banner?.id === id) return this.#banner;
                    break;
                case 'os-mismatch':
                    if (this.osMismatch) {
                        const layoutId = this.keymap?.layoutId ?? 'us';
                        return { id, kind: 'notice', text: osMismatchText(layoutId), layoutId };
                    }
                    break;
            }
        }
        return null;
    }
}

/** "Layer 1 is locked on", with the layer's name from `cosmetic.layer` when it has one (§5.3). */
export function layerLockedText(board: Pick<KeyboardInfo, 'cosmetic'> | undefined, layer: number): string {
    const name = board?.cosmetic?.layer?.[layer];
    return `${name && name.trim() ? name : `Layer ${layer}`} is locked on`;
}

/** Speed (CPM) and accuracy of a completion's record, as keybr's Result computes them. */
function recordSpeed({ record }: Completion): { speed: number; accuracy: number } {
    return {
        speed: record.t > 0 ? (record.n / (record.t / 1000)) * 60 : 0,
        accuracy: record.n > 0 ? (record.n - record.e) / record.n : 0,
    };
}
