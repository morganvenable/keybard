// Practice's controller (spec §4.1 Mounting, §5.2–§5.5, §5.9): the state behind
// the Lessons and Progress pages and the Lesson and Progress panels.
//
// A plain class, so its rules can be tested without React. PracticeEngine feeds
// it the keymap and the workspace state (usePracticeController) and publishes it;
// the pages and panels read it and call its methods. It never reads the board:
// M1b is Keymap only (Live · USB is M2).
//
// What it decides:
// - loading: the store (IndexedDB, or memory with a Storage off notice), the
//   English content, and the active profile's results;
// - the session (state/session.ts): rebuilt when the keymap fingerprint, the
//   profile or a lesson-shaping setting changes (sliders debounced 300 ms);
// - the lesson: a LessonRun, paused on blur, Esc, a hidden tab, leaving the page
//   or 10 s idle; kept 10 minutes while paused, then replaced;
// - the status slot: one notice or banner at a time, by the §5.2 priority.
import type { PracticeContent } from '../content/loader';
import type { PracticeStore } from '../store/db';
import { boardIdentity, newProfile, profileIdFor } from '../store/profiles';
import type { ProfileRecord, SnapshotRecord } from '../types';
import { type IInputEvent, type IKeyboardEvent } from '../vendor/keybr/textinput-events/index.ts';
import type { LessonRun } from './lessonRun';
import { type Completion, type LessonEvent, loadProfileData, PracticeSession, type PracticeKeymap, type ProfileData, resolvePracticeKeymap } from './session';
import { LESSON_SHAPING, type PracticeSettings, START_PRESETS, type StartPreset } from './settings';
import type { KeyboardInfo } from '@/types/keyboard.types';

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

/** Status slot items, highest priority first (§5.2). OS layout mismatch and Layer locked on are live only (M2). */
export const STATUS_PRIORITY = [
    'storage-off', 'newer-schema', 'os-mismatch', 'caps-lock', 'layer-locked', 'keymap-changed',
    'unsent-changes', 'board-connected', 'new-key', 'daily-goal', 'top-speed',
] as const;
export type StatusId = (typeof STATUS_PRIORITY)[number];

export type StatusItem =
    | { id: Exclude<StatusId, 'new-key' | 'daily-goal' | 'top-speed'>; kind: 'notice'; text: string }
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
    /** The last completed lesson could not be stored. */
    storageError = false;
    /** The most recent aria-live message (§5.12). */
    announcement = '';
    /** Code point unlocked by the last lesson: its board key and strip cap pulse (§5.3). */
    justUnlocked: number | null = null;
    /** Last completion, for the metrics' delta animation. */
    lastCompletion: Completion | null = null;
    /** A Lesson panel section to scroll to when the panel next shows (the type row's scope button). */
    panelSection: string | null = null;
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
    #banner: Extract<StatusItem, { kind: 'banner' }> | null = null;
    #transient = new Map<StatusId, number>();
    #timers = new Set<ReturnType<typeof setTimeout>>();
    #idleTimer: ReturnType<typeof setTimeout> | null = null;
    #rebuildTimer: ReturnType<typeof setTimeout> | null = null;
    #pausedSince: number | null = null;
    #completing = false;
    #disposed = false;
    #started = false;

    constructor(deps: ControllerDeps) {
        this.#deps = {
            now: () => Date.now(),
            clock: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
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
        this.version++;
        for (const listener of [...this.#listeners]) listener();
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
            && previous.defaultLayer === input.defaultLayer && previous.board.keylayout === input.board.keylayout;
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

    #rebuild() {
        if (this.#rebuildTimer) { clearTimeout(this.#rebuildTimer); this.#rebuildTimer = null; }
        this.saving = false;
        const resolved = this.#resolved;
        if (this.loadState !== 'ready' || !this.store || !this.content || !this.#profileData || !resolved) {
            this.#emit();
            return;
        }
        const hadLesson = pageSession.hadLesson;
        pageSession.hadLesson = false;
        this.session = new PracticeSession(this.store, this.persistent, this.content, resolved.keymap, resolved.resolution,
            resolved.fingerprint, this.settings, this.#profileData, this.#snapshot);
        // The snapshot only speeds up the first build; later builds replay (§6.8).
        this.#snapshot = undefined;
        if (hadLesson && this.keymap?.connected) this.#notify('board-connected');
        this.#newRun();
    }

    #newRun() {
        const session = this.session;
        this.#clearIdle();
        this.#pausedSince = null;
        if (!session || session.noLetters || session.firstRun) {
            this.run = null;
            this.#emit();
            return;
        }
        this.run = session.newRun();
        if (!this.#focused || !this.#active) this.#pause();
        this.#emit();
    }

    /** Discards the current lesson and starts a new one (Restart lesson, the type control). */
    regenerate() {
        this.#newRun();
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
    }

    get active() {
        return this.#active;
    }

    /** The typing surface gained or lost focus. Blur pauses; focus alone does not resume (§4.1). */
    setFocused(focused: boolean) {
        if (focused === this.#focused) return;
        this.#focused = focused;
        if (!focused) this.pause();
        else this.#emit();
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
        const outcome = run.onInput(event);
        if (outcome.ignored) {
            // Caps Lock keystrokes are dropped, but the notice must show (§5.3).
            if (run.capsLock) this.#emit();
            return;
        }
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
            const completion = await session.complete(run, {
                ts: this.#deps.now(), src: 'keymap', board: this.boardId, os: this.keymap.layoutId,
            });
            if (this.#disposed || this.session !== session) return;
            this.lastCompletion = completion;
            this.storageError = completion.storageError;
            if (completion.valid) {
                const { speed, accuracy } = recordSpeed(completion);
                const said = this.settings.speedUnit === 'cpm' ? `${Math.round(speed)} characters per minute` : `${(speed / 5).toFixed(1)} words per minute`;
                this.announcement = `Lesson complete. ${said}, ${Math.floor(accuracy * 100)} percent.`;
                this.#onEvents(completion.events);
            }
        } finally {
            this.#completing = false;
        }
        if (this.session === session) this.#newRun();
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

    /** The one item the status slot shows (§5.2 priority). */
    get status(): StatusItem | null {
        const now = this.#deps.now();
        const live = (id: StatusId) => (this.#transient.get(id) ?? 0) > now;
        for (const id of STATUS_PRIORITY) {
            switch (id) {
                case 'storage-off':
                    if (this.store && !this.persistent) return { id, kind: 'notice', text: NOTICE_TEXT[id] };
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
                case 'new-key':
                case 'daily-goal':
                case 'top-speed':
                    if (this.#banner?.id === id) return this.#banner;
                    break;
                default:
                    // os-mismatch and layer-locked need live input (M2).
                    break;
            }
        }
        return null;
    }
}

/** Speed (CPM) and accuracy of a completion's record, as keybr's Result computes them. */
function recordSpeed({ record }: Completion): { speed: number; accuracy: number } {
    return {
        speed: record.t > 0 ? (record.n / (record.t / 1000)) * 60 : 0,
        accuracy: record.n > 0 ? (record.n - record.e) / record.n : 0,
    };
}
