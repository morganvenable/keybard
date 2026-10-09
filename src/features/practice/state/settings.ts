// Practice settings (spec §8.1): one global JSON object in appStorage under
// `keybard.practice.v1`, read by a validating function that falls back per field
// (the style of Overlay's preferences()). Practice and Overlay share no settings.
//
// toKeybrSettings() turns them into the keybr Settings the vendored engine reads.
import { OWNER_Q1_DEFAULT_UNLOCK_ORDER } from '@/constants/owner-decisions';
import { appStorage } from '@/utils/app-storage';
import { lessonProps } from '../vendor/keybr/lesson/index.ts';
import { Settings } from '../vendor/keybr/settings/index.ts';
import { textInputProps } from '../vendor/keybr/textinput/index.ts';

export const SETTINGS_KEY = 'keybard.practice.v1';

export type UnlockOrder = 'center-first' | 'frequency';

export interface PracticeSettings {
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
    customText: { content: string; lowercase: boolean; lettersOnly: boolean; randomize: boolean };
    /** Active profile id (OWNER_Q6 'user' scope). */
    activeProfileId: string | null;
}

export const DEFAULT_SETTINGS: PracticeSettings = {
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
    customText: { content: 'The quick brown fox jumps over the lazy dog.', lowercase: true, lettersOnly: true, randomize: false },
    activeProfileId: null,
};

/**
 * Start (P2) presets (§5.4): each writes only these settings, so other changes
 * made in the Lesson panel survive.
 * TODO(practice): lesson type (Guided, Drill → Weakest) and hints join these once
 * the settings carry them (M1b session and lesson types, M3 Drill).
 */
export const START_PRESETS = {
    /** "Learn from the center keys": OWNER_Q1 order, 25 WPM, 15 min a day. */
    learn: { order: OWNER_Q1_DEFAULT_UNLOCK_ORDER, targetSpeed: 125, alphabetSize: 0, dailyGoal: 15 },
    /** "Coming from QWERTY": every letter included at once, 35 WPM, 15 min a day. */
    qwerty: { targetSpeed: 175, alphabetSize: 1, dailyGoal: 15 },
    /** "Drill my keymap": 45 WPM, 10 min a day. */
    drill: { targetSpeed: 225, dailyGoal: 10 },
} as const satisfies Record<string, Partial<PracticeSettings>>;

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

export function saveSettings(settings: PracticeSettings): void {
    try {
        appStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
        // Storage full or blocked: settings stay in memory for this session.
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
