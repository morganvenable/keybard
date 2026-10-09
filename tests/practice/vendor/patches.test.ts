// Tests for each Keybard patch to the vendored keybr engine (spec §9.2, §9.9).
// makeStats with gaps and pauses is in tests/practice/input/timeToType.test.ts;
// the Tab and timer patches are in the ported inputhandler test.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Layout, Language } from '@/features/practice/vendor/keybr/keyboard/index.ts';
import { lessonProps, LessonType, Lesson } from '@/features/practice/vendor/keybr/lesson/index.ts';
import { Preferences, booleanProp } from '@/features/practice/vendor/keybr/settings/index.ts';
import { Font } from '@/features/practice/vendor/keybr/textinput/index.ts';
import { appStorage } from '@/utils/app-storage';

const PRACTICE = resolve(__dirname, '../../../src/features/practice');
const VENDOR = join(PRACTICE, 'vendor/keybr');

function files(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? files(path) : [path];
    });
}

describe('vendored keybr patches', () => {
    it('lessonProps has no code or books props', () => {
        expect(Object.keys(lessonProps)).not.toContain('code');
        expect(Object.keys(lessonProps)).not.toContain('books');
        expect([...LessonType.ALL].map((t) => t.id)).toEqual(['guided', 'wordlist', 'custom', 'numbers']);
    });

    it('Lesson.filter keeps every result (Practice overrides it by path key)', () => {
        const results = [{} as never];
        expect(Lesson.prototype.filter.call({}, results)).toBe(results);
    });

    it('Layout keeps custom and EN_US only', () => {
        expect([...Layout.ALL].map((l) => l.id)).toEqual(['en-us']);
        expect(Layout.custom(Language.EN)).toMatchObject({ id: 'custom', family: 'custom' });
    });

    it('fonts are stubbed with one default', () => {
        expect(Font.default.id).toBe('default');
        expect(Font.select(Language.EN).size).toBe(1);
    });

    it('preferences live in Keybard\'s namespaced appStorage', () => {
        const prop = booleanProp('practice.test.flag', false);
        Preferences.set(prop, true);
        expect(appStorage.getItem('practice.test.flag')).toBe('true');
        expect(Preferences.get(prop)).toBe(true);
        Preferences.set(prop, null as unknown as boolean);
        expect(appStorage.getItem('practice.test.flag')).toBeNull();
    });

    it('every changed vendored file says why at the top', () => {
        const readme = readFileSync(join(VENDOR, 'README.md'), 'utf8');
        for (const path of files(VENDOR).filter((p) => /\.ts$/.test(p))) {
            const text = readFileSync(path, 'utf8');
            if (/^\/\/ Modified for Keybard:/.test(text)) {
                expect(readme, relative(VENDOR, path)).toContain(relative(VENDOR, path).replace(/\\/g, '/'));
            }
        }
        expect(readFileSync(join(VENDOR, 'LICENSE'), 'utf8')).toContain('GNU AFFERO GENERAL PUBLIC LICENSE');
        expect(readme).toContain('05a37bc5265f65ff538c59c613db29442f345d51');
    });
});

describe('bundle graph (M1a acceptance)', () => {
    const sources = files(PRACTICE).filter((p) => /\.(ts|tsx)$/.test(p));

    it('imports no @keybr package: every engine import is a vendored path', () => {
        for (const path of sources) expect(readFileSync(path, 'utf8'), relative(PRACTICE, path)).not.toMatch(/from\s+["']@keybr\//);
    });

    it('has no code grammars, books or book covers', () => {
        for (const path of sources) {
            const text = readFileSync(path, 'utf8');
            expect(text, relative(PRACTICE, path)).not.toMatch(/from\s+["'][^"']*\/(code|content-books|books)(\/index)?(\.ts)?["']/);
            expect(text, relative(PRACTICE, path)).not.toMatch(/Syntax\.ALL|Book\.ALL/);
        }
        expect(files(VENDOR).some((p) => /[\\/](code|books)\.ts$/.test(p))).toBe(false);
    });

    it('vendors no node-only, React or theme modules', () => {
        for (const path of files(VENDOR).filter((p) => /\.(ts|tsx)$/.test(p))) {
            const text = readFileSync(path, 'utf8');
            expect(text, relative(VENDOR, path)).not.toMatch(/from\s+["']node:/);
            expect(text, relative(VENDOR, path)).not.toMatch(/process\.env\.NODE_ENV [!=]==/);
            expect(text, relative(VENDOR, path)).not.toMatch(/from\s+["'][^"']*(react-intl|\/themes\/|\/widget\/)/);
        }
        expect(files(VENDOR).some((p) => p.endsWith('.tsx'))).toBe(false);
    });
});
