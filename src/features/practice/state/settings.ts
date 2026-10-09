// Practice settings (spec §8.1): one global JSON object in appStorage under
// `keybard.practice.v1`, read by a validating function that falls back per field
// (the style of Overlay's preferences()). Practice and Overlay share no settings.
//
// toKeybrSettings() turns them into the keybr Settings the vendored engine reads.
import { OWNER_Q1_DEFAULT_UNLOCK_ORDER } from '@/constants/owner-decisions';
import { appStorage } from '@/utils/app-storage';
import type { LessonType } from '../types';
import { lessonProps } from '../vendor/keybr/lesson/index.ts';
import { Settings } from '../vendor/keybr/settings/index.ts';
import { textInputProps } from '../vendor/keybr/textinput/index.ts';

export const SETTINGS_KEY = 'keybard.practice.v1';

export type UnlockOrder = 'center-first' | 'frequency';
/** Board hints (§5.2): next key and its cluster, next key only, or none. */
export type Hints = 'next-cluster' | 'next' | 'off';
export type SpeedUnit = 'wpm' | 'cpm';
/** Progress scope (§5.9): the last 7 or 30 days, or everything. */
export type ProgressPeriod = '7' | '30' | 'all';
export type ChartAxis = 'lessons' | 'days';

export const LESSON_TYPES: readonly LessonType[] = ['guided', 'drill', 'words', 'custom'];

/** Lesson types this build can run (all four since M3). */
export const AVAILABLE_LESSON_TYPES: readonly LessonType[] = LESSON_TYPES;

/** The lesson type a session runs for the stored choice. */
export function effectiveLessonType(type: LessonType): LessonType {
    return AVAILABLE_LESSON_TYPES.includes(type) ? type : 'guided';
}

/** Drill groups (§5.5): the Group tiles. */
export type DrillGroup = 'all' | 'letters' | 'numbers' | 'symbols' | 'weakest';
export const DRILL_GROUPS: readonly DrillGroup[] = ['all', 'letters', 'numbers', 'symbols', 'weakest'];
/** Finger-cluster directions (§5.5 Directions chips); 2S only shows on 6-key clusters. */
export type DrillDirection = 'C' | 'N' | 'S' | 'E' | 'W' | '2S';
export const DRILL_DIRECTIONS: readonly DrillDirection[] = ['C', 'N', 'S', 'E', 'W', '2S'];
export type DrillHands = 'both' | 'left' | 'right';

/** The Drill scope (§5.5, §6.2) and, from P5's Drill this key (§5.7), an explicit set of characters. */
export interface DrillSettings {
    /** Layer, or null for All. */
    layer: number | null;
    group: DrillGroup;
    /** Finger-cluster directions in scope (thumb keys follow `thumbs`). */
    dirs: DrillDirection[];
    hands: DrillHands;
    /** Characters whose target is a thumb key are in scope. */
    thumbs: boolean;
    /** Group = Numbers: keybr's number-shaped text (Benford's law) instead of digit tokens. */
    benford: boolean;
    /** Drill this key: these characters instead of the scope above; null otherwise. */
    keys: number[] | null;
    /** Drill this key: the character focused while it is below target. */
    focus: number | null;
}

export const DEFAULT_DRILL: DrillSettings = {
    layer: null, group: 'all', dirs: [...DRILL_DIRECTIONS], hands: 'both', thumbs: true, benford: true, keys: null, focus: null,
};

/** Words (§5.5): the size of the word list (most frequent first) and Long words only. */
export interface WordsSettings {
    size: number;
    longOnly: boolean;
}

export interface PracticeSettings {
    /** Lesson type (§5.2 type row). */
    type: LessonType;
    /** Guided unlock order (§6.3); new profiles start with OWNER_Q1. */
    order: UnlockOrder;
    /** Target speed in characters per minute (keybr: 175 CPM = 35 WPM, 75–750). */
    targetSpeed: number;
    /** 0–1: share of letters forced in from the start (QWERTY preset: 1). */
    alphabetSize: number;
    /** Focus and unlock follow current confidence instead of best. */
    recoverKeys: boolean;
    /** Dictionary words when at least 15 fit the filter, else pseudo-words. */
    naturalWords: boolean;
    /** 0–1 probabilities of capitals and punctuation in Guided text. */
    capitals: number;
    punctuators: number;
    /** 0–1: lesson length beyond the 100-character minimum. */
    length: number;
    repeatWords: number;
    /** Minutes per day; 0 turns the goal off. */
    dailyGoal: number;
    stopOnError: boolean;
    forgiveErrors: boolean;
    spaceSkipsWords: boolean;
    /** Live · USB: read key presses from the board while the text has focus (M2). */
    readKeyPresses: boolean;
    /** Display settings (§5.5): they apply live and keep the current lesson. */
    hints: Hints;
    legends: boolean;
    showBoard: boolean;
    speedUnit: SpeedUnit;
    showSpaces: boolean;
    layerUnderlines: boolean;
    announceNextKey: boolean;
    /** Progress page (§5.8, §5.9): period and the speed chart's x axis. */
    period: ProgressPeriod;
    chartAxis: ChartAxis;
    customText: { content: string; lowercase: boolean; lettersOnly: boolean; randomize: boolean };
    drill: DrillSettings;
    words: WordsSettings;
    /** Layer underlines in Drill (§5.2: on in Drill, off elsewhere by default); `layerUnderlines` is every other type's. */
    drillLayerUnderlines: boolean;
    /** Active profile id (OWNER_Q6 'user' scope). */
    activeProfileId: string | null;
}

export const DEFAULT_SETTINGS: PracticeSettings = {
    type: 'guided',
    order: OWNER_Q1_DEFAULT_UNLOCK_ORDER,
    targetSpeed: 175,
    alphabetSize: 0,
    recoverKeys: false,
    naturalWords: true,
    capitals: 0,
    punctuators: 0,
    length: 0,
    repeatWords: 1,
    dailyGoal: 15,
    stopOnError: true,
    forgiveErrors: true,
    spaceSkipsWords: false,
    readKeyPresses: true,
    hints: 'next-cluster',
    legends: true,
    showBoard: true,
    speedUnit: 'wpm',
    showSpaces: false,
    layerUnderlines: false,
    announceNextKey: false,
    period: '30',
    chartAxis: 'lessons',
    customText: { content: 'The quick brown fox jumps over the lazy dog.', lowercase: true, lettersOnly: true, randomize: false },
    drill: DEFAULT_DRILL,
    words: { size: 200, longOnly: false },
    drillLayerUnderlines: true,
    activeProfileId: null,
};

/**
 * Start (P2) presets (§5.4): each writes only these settings, so other changes
 * made in the Lesson panel survive.
 */
export const START_PRESETS = {
    /** "Learn from the center keys": Guided, OWNER_Q1 order, 25 WPM, next key + cluster, 15 min a day. */
    learn: { type: 'guided', order: OWNER_Q1_DEFAULT_UNLOCK_ORDER, targetSpeed: 125, alphabetSize: 0, hints: 'next-cluster', dailyGoal: 15 },
    /** "Coming from QWERTY": Guided, every letter included at once, 35 WPM, next key, 15 min a day. */
    qwerty: { type: 'guided', targetSpeed: 175, alphabetSize: 1, hints: 'next', dailyGoal: 15 },
    /** "Drill my keymap": Drill → Weakest over the whole keymap, 45 WPM, no hints, 10 min a day. */
    drill: { type: 'drill', drill: { ...DEFAULT_DRILL, group: 'weakest' }, targetSpeed: 225, hints: 'off', dailyGoal: 10 },
} as const satisfies Record<string, Partial<PracticeSettings>>;

export type StartPreset = keyof typeof START_PRESETS;

/** Settings that shape the lesson text: changing one regenerates the lesson (§5.5 "When settings apply"). */
export const LESSON_SHAPING: readonly (keyof PracticeSettings)[] = [
    'type', 'order', 'alphabetSize', 'recoverKeys', 'naturalWords', 'capitals', 'punctuators', 'length',
    'repeatWords', 'targetSpeed', 'customText', 'stopOnError', 'forgiveErrors', 'spaceSkipsWords', 'drill', 'words',
];

/** Layer underlines for the current lesson type (§5.2: on in Drill, off in Guided, by default). */
export function layerUnderlinesFor(s: Pick<PracticeSettings, 'type' | 'layerUnderlines' | 'drillLayerUnderlines'>): boolean {
    return effectiveLessonType(s.type) === 'drill' ? s.drillLayerUnderlines : s.layerUnderlines;
}

/** The patch that sets the current type's layer underlines. */
export function layerUnderlinesPatch(type: LessonType, value: boolean): Partial<PracticeSettings> {
    return effectiveLessonType(type) === 'drill' ? { drillLayerUnderlines: value } : { layerUnderlines: value };
}

/** WPM and CPM: keybr counts five characters per word. */
export const cpmToWpm = (cpm: number) => cpm / 5;
export const wpmToCpm = (wpm: number) => wpm * 5;

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
    return typeof value === 'string' && (options as readonly string[]).includes(value) ? (value as T) : fallback;
}

export const MAX_CUSTOM_TEXT = 10_000;
export const WORD_LIST_MIN = 10;
export const WORD_LIST_MAX = 1000;
/** Matrix layers Keybard can hold (a Drill layer beyond the keymap finds nothing to drill). */
const MAX_LAYER = 31;

function codePointList(value: unknown): number[] | null {
    if (!Array.isArray(value)) return null;
    const list = value.filter((v): v is number => Number.isSafeInteger(v) && v > 0 && v <= 0x10ffff);
    return list.length ? [...new Set(list)] : null;
}

/** Validates a stored Drill scope field by field. */
export function drillSettings(value: unknown): DrillSettings {
    const d = DEFAULT_DRILL;
    const data = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
    const dirs = Array.isArray(data.dirs) ? DRILL_DIRECTIONS.filter((dir) => (data.dirs as unknown[]).includes(dir)) : d.dirs;
    const focus = Number.isSafeInteger(data.focus) && (data.focus as number) > 0 ? (data.focus as number) : null;
    const keys = codePointList(data.keys);
    return {
        layer: Number.isSafeInteger(data.layer) && (data.layer as number) >= 0 && (data.layer as number) <= MAX_LAYER ? (data.layer as number) : null,
        group: oneOf(data.group, DRILL_GROUPS, d.group),
        dirs: [...dirs],
        hands: oneOf(data.hands, ['both', 'left', 'right'] as const, d.hands),
        thumbs: bool(data.thumbs, d.thumbs),
        benford: bool(data.benford, d.benford),
        keys,
        focus: keys && focus != null && keys.includes(focus) ? focus : null,
    };
}

function number(value: unknown, min: number, max: number, fallback: number) {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function bool(value: unknown, fallback: boolean) {
    return typeof value === 'boolean' ? value : fallback;
}

/** Validates stored settings field by field; anything missing or malformed takes its default. */
export function practiceSettings(value: unknown): PracticeSettings {
    const d = DEFAULT_SETTINGS;
    const data = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
    const custom = data.customText && typeof data.customText === 'object' ? (data.customText as Record<string, unknown>) : {};
    const words = data.words && typeof data.words === 'object' ? (data.words as Record<string, unknown>) : {};
    return {
        type: oneOf(data.type, LESSON_TYPES, d.type),
        order: data.order === 'center-first' || data.order === 'frequency' ? data.order : d.order,
        targetSpeed: Math.round(number(data.targetSpeed, 75, 750, d.targetSpeed)),
        alphabetSize: number(data.alphabetSize, 0, 1, d.alphabetSize),
        recoverKeys: bool(data.recoverKeys, d.recoverKeys),
        naturalWords: bool(data.naturalWords, d.naturalWords),
        capitals: number(data.capitals, 0, 1, d.capitals),
        punctuators: number(data.punctuators, 0, 1, d.punctuators),
        length: number(data.length, 0, 1, d.length),
        repeatWords: Math.round(number(data.repeatWords, 1, 10, d.repeatWords)),
        dailyGoal: Math.round(number(data.dailyGoal, 0, 120, d.dailyGoal)),
        stopOnError: bool(data.stopOnError, d.stopOnError),
        forgiveErrors: bool(data.forgiveErrors, d.forgiveErrors),
        spaceSkipsWords: bool(data.spaceSkipsWords, d.spaceSkipsWords),
        readKeyPresses: bool(data.readKeyPresses, d.readKeyPresses),
        hints: oneOf(data.hints, ['next-cluster', 'next', 'off'] as const, d.hints),
        legends: bool(data.legends, d.legends),
        showBoard: bool(data.showBoard, d.showBoard),
        speedUnit: oneOf(data.speedUnit, ['wpm', 'cpm'] as const, d.speedUnit),
        showSpaces: bool(data.showSpaces, d.showSpaces),
        layerUnderlines: bool(data.layerUnderlines, d.layerUnderlines),
        announceNextKey: bool(data.announceNextKey, d.announceNextKey),
        period: oneOf(data.period, ['7', '30', 'all'] as const, d.period),
        chartAxis: oneOf(data.chartAxis, ['lessons', 'days'] as const, d.chartAxis),
        customText: {
            content: typeof custom.content === 'string' ? custom.content.slice(0, MAX_CUSTOM_TEXT) : d.customText.content,
            lowercase: bool(custom.lowercase, d.customText.lowercase),
            lettersOnly: bool(custom.lettersOnly, d.customText.lettersOnly),
            randomize: bool(custom.randomize, d.customText.randomize),
        },
        drill: drillSettings(data.drill),
        words: {
            size: Math.round(number(words.size, WORD_LIST_MIN, WORD_LIST_MAX, d.words.size)),
            longOnly: bool(words.longOnly, d.words.longOnly),
        },
        drillLayerUnderlines: bool(data.drillLayerUnderlines, d.drillLayerUnderlines),
        activeProfileId: typeof data.activeProfileId === 'string' && data.activeProfileId ? data.activeProfileId : null,
    };
}

export function loadSettings(): PracticeSettings {
    try {
        const raw = appStorage.getItem(SETTINGS_KEY);
        return practiceSettings(raw ? JSON.parse(raw) : null);
    } catch {
        return practiceSettings(null);
    }
}

/** Writes the settings; false when storage refused them (the panel shows its error footer). */
export function saveSettings(settings: PracticeSettings): boolean {
    try {
        appStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        return true;
    } catch {
        // Storage full or blocked: settings stay in memory for this session.
        return false;
    }
}

/** The keybr Settings the vendored lesson and text input read. */
export function toKeybrSettings(s: PracticeSettings): Settings {
    return new Settings()
        .set(lessonProps.guided.keyboardOrder, s.order === 'center-first')
        .set(lessonProps.guided.alphabetSize, s.alphabetSize)
        .set(lessonProps.guided.recoverKeys, s.recoverKeys)
        .set(lessonProps.guided.naturalWords, s.naturalWords)
        .set(lessonProps.capitals, s.capitals)
        .set(lessonProps.punctuators, s.punctuators)
        .set(lessonProps.length, s.length)
        .set(lessonProps.repeatWords, s.repeatWords)
        .set(lessonProps.targetSpeed, s.targetSpeed)
        .set(lessonProps.dailyGoal, s.dailyGoal)
        .set(lessonProps.customText.content, s.customText.content)
        .set(lessonProps.customText.lowercase, s.customText.lowercase)
        .set(lessonProps.customText.lettersOnly, s.customText.lettersOnly)
        .set(lessonProps.customText.randomize, s.customText.randomize)
        .set(lessonProps.wordList.wordListSize, s.words.size)
        .set(lessonProps.wordList.longWordsOnly, s.words.longOnly)
        .set(lessonProps.numbers.benford, s.drill.benford)
        .set(textInputProps.stopOnError, s.stopOnError)
        .set(textInputProps.forgiveErrors, s.forgiveErrors)
        .set(textInputProps.spaceSkipsWords, s.spaceSkipsWords);
}
