// English content loader (spec §7.1, §7.5): replaces keybr's
// phonetic-model-loader (webpack asset URLs, @keybr/request) and the word-list
// loader. The model is a Vite `?url` asset fetched on first use; the word list is
// a lazy JSON chunk. Both load only when Practice first needs them.
//
// TODO(practice): M1b adds the Paranoid branch, `virtual:practice-content`, which
// inlines both (base64 model, JSON words) because Paranoid fetches only 'self',
// data: and blob: (build/paranoid.ts); the loader then prefers it when non-null.
import { base64ToBytes } from '../store/base64';
import { type WordList } from '../vendor/keybr/content/index.ts';
import { Language } from '../vendor/keybr/keyboard/index.ts';
import { censor, makePhoneticModel, type PhoneticModel } from '../vendor/keybr/phonetic-model/index.ts';

export interface PracticeContent {
    model: PhoneticModel;
    words: WordList;
}

/** Builds the English phonetic model from `model-en.data` bytes, with keybr's censoring. */
export function englishModelFromBytes(bytes: Uint8Array): PhoneticModel {
    return censor(makePhoneticModel(Language.EN, bytes));
}

/** Builds the model from the base64 form Paranoid inlines (M1b). */
export function englishModelFromBase64(base64: string): PhoneticModel {
    return englishModelFromBytes(base64ToBytes(base64));
}

export async function loadEnglishModel(fetchImpl: typeof fetch = (...args) => fetch(...args)): Promise<PhoneticModel> {
    const { default: url } = await import('./assets/model-en.data?url');
    const response = await fetchImpl(url);
    if (!response.ok) throw new Error(`Practice: could not load the English model (${response.status})`);
    return englishModelFromBytes(new Uint8Array(await response.arrayBuffer()));
}

export async function loadEnglishWords(): Promise<WordList> {
    return (await import('./assets/words-en.json')).default as WordList;
}

let cached: Promise<PracticeContent> | null = null;

/** Loads (once) and caches the English model and word list. */
export function loadEnglishContent(): Promise<PracticeContent> {
    if (!cached) {
        cached = Promise.all([loadEnglishModel(), loadEnglishWords()]).then(([model, words]) => ({ model, words }));
        cached.catch(() => { cached = null; });
    }
    return cached;
}
