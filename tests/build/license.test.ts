// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KEYBARD_LICENSE, KEYBARD_SOURCE_URL } from '@/constants/license';
import { OWNER_Q2_LICENSE } from '@/constants/owner-decisions';
import { licenseNotice, lockDown, SOURCE_URL } from '../../build/paranoid';

const root = resolve(__dirname, '../..');
const page = '<!doctype html>\n<html><head><meta charset="UTF-8" /><script>window.a = 1;</script></head><body></body></html>';

describe('Keybard license (spec §11, OWNER_Q2)', () => {
    it('declares OWNER_Q2 in package.json, with the AGPL text at the root', () => {
        const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { license: string };
        expect(pkg.license).toBe(OWNER_Q2_LICENSE);
        expect(KEYBARD_LICENSE).toBe(OWNER_Q2_LICENSE);
        expect(readFileSync(resolve(root, 'LICENSE'), 'utf8')).toMatch(/^\s*GNU AFFERO GENERAL PUBLIC LICENSE/);
    });

    it('About and the Paranoid file point at the same source', () => {
        expect(SOURCE_URL).toBe(KEYBARD_SOURCE_URL);
    });

    it('puts the notice and source URL in the Paranoid file, after the doctype', () => {
        const out = lockDown(page, licenseNotice(OWNER_Q2_LICENSE));
        expect(out).toMatch(/^<!doctype html>\n<!--\n/);
        expect(out).toContain(`licensed ${OWNER_Q2_LICENSE}`);
        expect(out).toContain(`Source code: ${KEYBARD_SOURCE_URL}`);
        expect(out).toContain('keybr.com');
        // Still locked down: the notice is a comment, not a reference.
        expect(out).toContain('Content-Security-Policy');
        expect(lockDown(page)).not.toContain('<!--');
    });

    it('keeps the notice inside its comment', () => {
        const out = lockDown(page, 'a --> <script>b</script> --');
        const comment = out.slice(out.indexOf('<!--') + 4, out.indexOf('-->'));
        expect(comment).toContain('<script)b</script)');
        expect(out.indexOf('-->')).toBeGreaterThan(out.indexOf('<script)'));
    });
});
