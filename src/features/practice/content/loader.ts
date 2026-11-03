import { loadBooks, type BookTexts } from './books';
// Language content loader (spec §7.1, §7.5): replaces keybr's
// phonetic-model-loader (webpack asset URLs, @keybr/request) and the word-list
// loader. The model is a Vite `?url` asset fetched on first use; the word list is
// a lazy JSON chunk. Both load only when Practice first needs them.
//
// Paranoid fetches only 'self', data: and blob: (build/paranoid.ts), so there the
// model (base64) and the word list come compiled in through the virtual module
// `virtual:practice-content`, which is null in every other build. The asset
// branch is dead code in Paranoid (the mode is a build-time constant, compared
// here so the bundler can drop the branch), so the words aren't bundled twice.
import practiceContent from 'virtual:practice-content';
import { base64ToBytes } from '../store/base64';
import { type WordList } from '../vendor/keybr/content/index.ts';
import { Language } from '../vendor/keybr/keyboard/index.ts';
import { censor, makePhoneticModel, type PhoneticModel } from '../vendor/keybr/phonetic-model/index.ts';

export interface PracticeContent {
    model: PhoneticModel;
    words: WordList;
    books?: BookTexts;
}

export const PRACTICE_LANGUAGES = [...Language.ALL];
export const PRACTICE_LANGUAGE_IDS = PRACTICE_LANGUAGES.map((language) => language.id);

const modelAssets = import.meta.glob('./assets/model-*.data', { query: '?url', import: 'default' }) as Record<string, () => Promise<string>>;
const wordAssets = import.meta.glob('./assets/words-*.json', { query: '?url', import: 'default' }) as Record<string, () => Promise<string>>;

export function modelFromBytes(language: Language, bytes: Uint8Array): PhoneticModel {
    return censor(makePhoneticModel(language, bytes));
}

/** Builds the English phonetic model from `model-en.data` bytes. */
export function englishModelFromBytes(bytes: Uint8Array): PhoneticModel {
    return modelFromBytes(Language.EN, bytes);
}

export function modelFromBase64(language: Language, base64: string): PhoneticModel {
    return modelFromBytes(language, base64ToBytes(base64));
}

/** Builds the English model from the base64 form Paranoid inlines. */
export function englishModelFromBase64(base64: string): PhoneticModel {
    return modelFromBase64(Language.EN, base64);
}

export async function loadModel(language: Language, fetchImpl: typeof fetch = (...args) => fetch(...args)): Promise<PhoneticModel> {
    const loadUrl = modelAssets[`./assets/model-${language.id}.data`];
    if (!loadUrl) throw new Error(`Practice: no model for ${language.id}`);
    const url = await loadUrl();
    const response = await fetchImpl(url);
    if (!response.ok) throw new Error(`Practice: could not load the ${language.id} model (${response.status})`);
    return modelFromBytes(language, new Uint8Array(await response.arrayBuffer()));
}

export async function loadEnglishModel(fetchImpl: typeof fetch = (...args) => fetch(...args)): Promise<PhoneticModel> {
    return loadModel(Language.EN, fetchImpl);
}

export async function loadEnglishWords(): Promise<WordList> {
    return (await import('./assets/words-en.json')).default as WordList;
}

export async function loadWords(language: Language, fetchImpl: typeof fetch = (...args) => fetch(...args)): Promise<WordList> {
    const loadWords = wordAssets[`./assets/words-${language.id}.json`];
    if (!loadWords) throw new Error(`Practice: no word list for ${language.id}`);
    const response = await fetchImpl(await loadWords());
    if (!response.ok) throw new Error(`Practice: could not load the ${language.id} word list (${response.status})`);
    return (await response.json()) as WordList;
}

type InlinedLanguageContent = { model: string; words: string[] };
type InlinedContent = Record<string, InlinedLanguageContent>;
type LegacyInlinedContent = { model: string; words: string[] };
type BundledInlinedContent = { languages: InlinedContent; model: string; words: string[] };

/** The content compiled into the Paranoid file, or null in other builds. */
export function inlinedContent(inlined: InlinedContent | LegacyInlinedContent | BundledInlinedContent | null = practiceContent): InlinedContent | PracticeContent | null {
    if (!inlined) return null;
    if ('languages' in inlined) return (inlined as BundledInlinedContent).languages;
    const model = (inlined as LegacyInlinedContent).model;
    if (typeof model === 'string') {
        return { model: englishModelFromBase64(model), words: (inlined as LegacyInlinedContent).words };
    }
    return inlined as InlinedContent;
}

const PARANOID_BUILD = import.meta.env.MODE === 'paranoid';
const cached = new Map<string, Promise<PracticeContent>>();

/** Loads (once per language) and caches the selected model, word list and books. */
export function loadContent(languageId = Language.EN.id): Promise<PracticeContent> {
    const language = Language.ALL.get(languageId, Language.EN);
    let result = cached.get(language.id);
    if (!result) {
        result = PARANOID_BUILD
            ? Promise.resolve().then(async () => {
                const content = inlinedContent();
                const selected = content && 'model' in content ? null : content?.[language.id];
                if (!selected) throw new Error(`Practice: the Paranoid build has no ${language.id} content`);
                return { model: modelFromBase64(language, selected.model), words: selected.words, books: await loadBooks() };
            })
            : Promise.all([loadModel(language), loadWords(language), loadBooks()]).then(([model, words, books]) => ({ model, words, books }));
        cached.set(language.id, result);
        result.catch(() => { if (cached.get(language.id) === result) cached.delete(language.id); });
    }
    return result;
}

/** Backwards-compatible English entry point for existing callers and fixtures. */
export const loadEnglishContent = (languageId = Language.EN.id) => loadContent(languageId);
