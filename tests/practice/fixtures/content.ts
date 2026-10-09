// The bundled English content, read from disk for tests.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { englishModelFromBytes } from '@/features/practice/content/loader';
import type { PhoneticModel } from '@/features/practice/vendor/keybr/phonetic-model/index.ts';

const ASSETS = resolve(__dirname, '../../../src/features/practice/content/assets');

let model: PhoneticModel | null = null;
let words: string[] | null = null;

export function englishModel(): PhoneticModel {
    return (model ??= englishModelFromBytes(new Uint8Array(readFileSync(resolve(ASSETS, 'model-en.data')))));
}

export function englishWords(): string[] {
    return (words ??= JSON.parse(readFileSync(resolve(ASSETS, 'words-en.json'), 'utf8')));
}
