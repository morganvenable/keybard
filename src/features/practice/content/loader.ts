// English content loader (spec §7.1, §7.5): replaces keybr's
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

/** The content compiled into the Paranoid file, or null in other builds. */
export function inlinedContent(inlined: { model: string; words: string[] } | null = practiceContent): PracticeContent | null {
    return inlined ? { model: englishModelFromBase64(inlined.model), words: inlined.words } : null;
}

const PARANOID_BUILD = import.meta.env.MODE === 'paranoid';

let cached: Promise<PracticeContent> | null = null;

/** Loads (once) and caches the English model and word list. A failed load can be retried. */
export function loadEnglishContent(): Promise<PracticeContent> {
    if (!cached) {
        cached = PARANOID_BUILD
            ? Promise.resolve().then(() => {
                const content = inlinedContent();
                if (!content) throw new Error('Practice: the Paranoid build has no inlined content');
                return content;
            })
            : Promise.all([loadEnglishModel(), loadEnglishWords()]).then(([model, words]) => ({ model, words }));
        cached.catch(() => { cached = null; });
    }
    return cached;
}
