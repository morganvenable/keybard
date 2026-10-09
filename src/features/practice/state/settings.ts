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

/**
 * Lesson types this build can run. Until M3 only Guided exists; a stored Drill, Words or Custom
 * choice (the Drill my keymap preset) runs as Guided until then.
 * TODO(practice): M3 adds drill, words and custom.
 */
export const AVAILABLE_LESSON_TYPES: readonly LessonType[] = ['guided'];

/** The lesson type a session runs for the stored choice. */
export function effectiveLessonType(type: LessonType): LessonType {
    return AVAILABLE_LESSON_TYPES.includes(type) ? type : 'guided';
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
    /**
     * "Drill my keymap": Drill → Weakest, 45 WPM, no hints, 10 min a day.
     * TODO(practice): M3 runs Drill → Weakest. Until then the stored Drill choice runs as Guided
     * (effectiveLessonType), so the preset also includes every letter and follows current
     * confidence, which is Weakest's focus rule over the letters; M3 drops those two fields.
     */
    drill: { type: 'drill', targetSpeed: 225, hints: 'off', dailyGoal: 10, alphabetSize: 1, recoverKeys: true },
} as const satisfies Record<string, Partial<PracticeSettings>>;

export type StartPreset = keyof typeof START_PRESETS;

/** Settings that shape the lesson text: changing one regenerates the lesson (§5.5 "When settings apply"). */
export const LESSON_SHAPING: readonly (keyof PracticeSettings)[] = [
    'type', 'order', 'alphabetSize', 'recoverKeys', 'naturalWords', 'capitals', 'punctuators', 'length',
    'repeatWords', 'targetSpeed', 'customText', 'stopOnError', 'forgiveErrors', 'spaceSkipsWords',
];

/** WPM and CPM: keybr counts five characters per word. */
export const cpmToWpm = (cpm: number) => cpm / 5;
export const wpmToCpm = (wpm: number) => wpm * 5;

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
    return typeof value === 'string' && (options as readonly string[]).includes(value) ? (value as T) : fallback;
}

const MAX_CUSTOM_TEXT = 10_000;

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
        .set(textInputProps.stopOnError, s.stopOnError)
        .set(textInputProps.forgiveErrors, s.forgiveErrors)
        .set(textInputProps.spaceSkipsWords, s.spaceSkipsWords);
}
