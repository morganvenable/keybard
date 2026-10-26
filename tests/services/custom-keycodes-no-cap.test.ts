// Custom keycodes past the catalog's 32: a board can report up to 448, the QMK
// QK_USER range (0x7E40-0x7FFF). Each test loads fresh keycode tables, since the
// tables are module state that a board's custom keycodes change.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CustomKeycode, KeyboardInfo } from '../../src/types/keyboard.types';

const customKeycodes = (n: number): CustomKeycode[] =>
    Array.from({ length: n }, (_, i) => ({ name: `SV_TEST_${i}`, shortName: `Test\\n${i}`, title: `Test key ${i}` }));

async function load() {
    const keygen = await import('../../src/constants/keygen');
    const { keyService } = await import('../../src/services/key.service');
    const { fileService } = await import('../../src/services/file.service');
    const { getKeyContents } = await import('../../src/utils/keys');
    const qkUser = await import('../../src/constants/qk-user');
    return { ...keygen, keyService, fileService, getKeyContents, ...qkUser };
}

function board(n: number, keymap: number[] = []): KeyboardInfo {
    return {
        name: 'Test board',
        kbid: '1234',
        rows: 1,
        cols: keymap.length || 1,
        layers: 1,
        keymap: [keymap.length ? keymap : [0]],
        custom_keycodes: customKeycodes(n),
    } as unknown as KeyboardInfo;
}

beforeEach(() => {
    vi.resetModules();
});

describe('QK_USER range constants', () => {
    it('covers 0x7E40 to 0x7FFF, 448 codes', async () => {
        const { QK_USER, QK_USER_MAX, QK_USER_COUNT, qkUserIndex, qkUserName } = await load();
        expect(QK_USER).toBe(0x7e40);
        expect(QK_USER_MAX).toBe(0x7fff);
        expect(QK_USER_COUNT).toBe(448);
        expect(qkUserName(0)).toBe('QK_USER');
        expect(qkUserName(40)).toBe('QK_USER_40');
        expect(qkUserIndex('QK_USER')).toBe(0);
        expect(qkUserIndex('QK_USER_0')).toBe(0);
        expect(qkUserIndex('QK_USER_447')).toBe(447);
        expect(qkUserIndex('QK_USER_448')).toBeNull();
        expect(qkUserIndex('QK_USER_040')).toBeNull();
        expect(qkUserIndex('QK_USER_MAX')).toBeNull();
        expect(qkUserIndex('USER40')).toBeNull();
    });
});

describe('a board with 31 custom keycodes is unchanged', () => {
    it('names QK_USER_0..30 and leaves QK_USER_31 and everything after as before', async () => {
        const { keyService, KEYMAP, CODEMAP } = await load();
        keyService.generateAllKeycodes(board(31));

        expect(keyService.stringify(0x7e40)).toBe('SV_TEST_0');
        expect(keyService.stringify(0x7e5e)).toBe('SV_TEST_30');
        expect(keyService.parse('SV_TEST_30')).toBe(0x7e5e);
        // Position 31 is the catalog's unnamed QK_USER_31, as before.
        expect(keyService.stringify(0x7e5f)).toBe('QK_USER_31');
        expect(KEYMAP['QK_USER_31'].qmkid).toBe('QK_USER_31');
        // Past the catalog: no entries are made, and codes read as numbers, as before.
        expect(KEYMAP['QK_USER_32']).toBeUndefined();
        expect(CODEMAP[0x7e60]).toBeUndefined();
        expect(keyService.stringify(0x7e60)).toBe('0x7e60');
        expect(CODEMAP[0x7fff]).toBe('QK_USER_MAX');
        // USERnn (QK_KB, 0x7E00+) keeps its codes; how it is named is not this change's.
        expect(KEYMAP['USER05'].code).toBe(0x7e05);
    });
});

describe('a board with 40 custom keycodes', () => {
    it('names every position both ways, including the 33rd on', async () => {
        const { keyService, KEYMAP, KEYALIASES } = await load();
        keyService.generateAllKeycodes(board(40));

        for (const i of [0, 31, 32, 33, 39]) {
            const code = 0x7e40 + i;
            expect(keyService.stringify(code)).toBe(`SV_TEST_${i}`);
            expect(keyService.parse(`SV_TEST_${i}`)).toBe(code);
            expect(keyService.parse(i === 0 ? 'QK_USER' : `QK_USER_${i}`)).toBe(code);
        }
        expect(KEYMAP['QK_USER_32']).toEqual({ code: 0x7e60, qmkid: 'SV_TEST_32', str: 'Test\n32', title: 'Test key 32' });
        expect(KEYALIASES['SV_TEST_39']).toBe('QK_USER_39');
        expect(keyService.define(0x7e67)?.qmkid).toBe('SV_TEST_39');
        // Nothing past what the board reports.
        expect(KEYMAP['QK_USER_40']).toBeUndefined();
        expect(keyService.stringify(0x7e68)).toBe('0x7e68');
    });

    it('shows the board labels on the keymap for positions past 32', async () => {
        const { keyService, getKeyContents } = await load();
        const kb = board(40);
        keyService.generateAllKeycodes(kb);

        const byName = getKeyContents(kb, keyService.stringify(0x7e64));
        expect(byName?.str).toBe('Test\n36');
        const byQkUser = getKeyContents(kb, 'QK_USER_36');
        expect(byQkUser).toMatchObject({ type: 'user', str: 'Test\n36', title: 'Test key 36' });
    });

    it('round-trips a .svil export and import, by name', async () => {
        const { keyService, fileService } = await load();
        const codes = [0x7e40, 0x7e5f, 0x7e60, 0x7e67, 0x0004];
        const kb = board(40, codes);
        keyService.generateAllKeycodes(kb);

        const svil = JSON.parse(fileService.kbinfoToSvil(kb));
        expect(svil.layout[0][0]).toEqual(['SV_TEST_0', 'SV_TEST_31', 'SV_TEST_32', 'SV_TEST_39', 'KC_A']);
        const back = fileService.svilToKBINFO(svil);
        expect(back.keymap?.[0]).toEqual(codes);
    });

    it('round-trips a .vil export and import, by name', async () => {
        const { keyService, fileService } = await load();
        const codes = [0x7e45, 0x7e66];
        const kb = board(40, codes);
        keyService.generateAllKeycodes(kb);

        const vil = JSON.parse(fileService.kbinfoToVIL(kb, false));
        expect(vil.layout[0][0]).toEqual(['SV_TEST_5', 'SV_TEST_38']);
        expect(fileService.vilToKBINFO(vil).keymap?.[0]).toEqual(codes);
    });

    it('parses QK_USER_<n> names in a layout file before any board names them', async () => {
        const { keyService } = await load();
        expect(keyService.parse('QK_USER_40')).toBe(0x7e68);
        expect(keyService.parse('QK_USER_447')).toBe(0x7fff);
        expect(keyService.define('QK_USER_40')).toMatchObject({ code: 0x7e68, str: 'QK_USER_40' });
        expect(Number.isNaN(keyService.parse('QK_USER_448'))).toBe(true);
    });
});

describe('a board with the full 448 custom keycodes', () => {
    it('names all of QK_USER through QK_USER_MAX, and nothing past it', async () => {
        const { keyService, KEYMAP, CODEMAP } = await load();
        const before0x8000 = CODEMAP[0x8000];
        keyService.generateAllKeycodes(board(448));

        expect(keyService.stringify(0x7e40)).toBe('SV_TEST_0');
        expect(keyService.stringify(0x7fff)).toBe('SV_TEST_447');
        expect(keyService.parse('SV_TEST_447')).toBe(0x7fff);
        expect(keyService.parse('QK_USER_447')).toBe(0x7fff);
        expect(KEYMAP['QK_USER_200'].qmkid).toBe('SV_TEST_200');
        expect(CODEMAP[0x8000]).toBe(before0x8000);
    });

    it('ignores custom keycodes a board reports past the range', async () => {
        const { keyService, KEYMAP, CODEMAP } = await load();
        const before0x8000 = CODEMAP[0x8000];
        keyService.generateAllKeycodes(board(450));

        expect(KEYMAP['SV_TEST_448']).toBeUndefined();
        expect(KEYMAP['QK_USER_448']).toBeUndefined();
        expect(CODEMAP[0x8000]).toBe(before0x8000);
        expect(CODEMAP[0x8001]).toBeUndefined();
    });
});

describe('known custom keycodes with no board connected', () => {
    it('registers positions past 32 that no board has named', async () => {
        const { keyService } = await load();
        keyService.registerKnownCustomKeycodes(customKeycodes(40));
        expect(keyService.parse('SV_TEST_35')).toBe(0x7e63);
        expect(keyService.stringify(0x7e63)).toBe('SV_TEST_35');
    });

    it('leaves a position a board already named', async () => {
        const { keyService } = await load();
        keyService.generateAllKeycodes(board(40));
        keyService.registerKnownCustomKeycodes([...Array(35).fill(null).map((_, i) => ({ name: `OTHER_${i}`, title: '' })), { name: 'OTHER_35', title: '' }]);
        expect(keyService.stringify(0x7e63)).toBe('SV_TEST_35');
        expect(keyService.parse('OTHER_35')).toBeNaN();
    });
});
