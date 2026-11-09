import { describe, expect, it } from 'vitest';
import { SETTINGS } from '../../src/contexts/SettingsContext';
import { HARDWARE_OPEN_SETTING, POINTING_ADVANCED, SETTINGS_PAGE, SETTINGS_SHOWN_ELSEWHERE, blocksOnPage, sectionStateSetting, settingsOnPage, CONDITIONAL_SECTIONS, shownPage } from '../../src/layout/SecondarySidebar/Panels/settings/layout';
import { searchSettings } from '../../src/layout/SecondarySidebar/Panels/settings/search';

describe('Settings page declaration', () => {
    const onPage = settingsOnPage();

    it('names only settings that exist, each once', () => {
        const names = new Set(SETTINGS.map((s) => s.name));
        for (const name of onPage) expect(names.has(name), name).toBe(true);
        expect(new Set(onPage).size).toBe(onPage.length);
    });

    it('never places board configuration on the page', () => {
        for (const name of onPage) {
            expect(SETTINGS.find((s) => s.name === name)?.scope, name).not.toBe('hardware');
        }
    });

    it('places every setting on the page or names its one home elsewhere, never both', () => {
        for (const def of SETTINGS) {
            const here = onPage.includes(def.name);
            const elsewhere = def.name in SETTINGS_SHOWN_ELSEWHERE;
            expect(here || elsewhere, `${def.name} needs a row in settings/layout.ts or an entry in SETTINGS_SHOWN_ELSEWHERE`).toBe(true);
            expect(here && elsewhere, def.name).toBe(false);
        }
    });

    it('leaves out the retired settings: binding editor placement, ball gloss and sparkle', () => {
        for (const name of ['combo-editor-placement', 'pointing-ball-gloss', 'pointing-sparkle']) {
            expect(onPage).not.toContain(name);
            expect(SETTINGS.find((s) => s.name === name), name).toBeUndefined();
        }
    });

    it('is eight cards, each with a chip, a summary and a sentence-case title', () => {
        expect(SETTINGS_PAGE.map((s) => s.title)).toEqual(['Hardware', 'Pointing', 'Firmware', 'Backups', 'Appearance and editing', 'Typing behavior', 'Power and scanning', 'About']);
        expect(SETTINGS_PAGE.map((s) => s.chip)).toEqual(['Hardware', 'Pointing', 'Firmware', 'Backups', 'Appearance', 'Typing', 'Power', 'About']);
        for (const s of SETTINGS_PAGE) {
            expect(s.summary, s.id).not.toBe('');
            expect(s.title.slice(1), s.title).toBe(s.title.slice(1).toLowerCase());
        }
    });

    it('keeps Firmware to firmware, and backups, import and export in Backups', () => {
        const rows = (id: string) => SETTINGS_PAGE.find((s) => s.id === id)!.rows.map((r) => ('block' in r ? `block:${r.block}` : r.setting));
        expect(rows('firmware')).toEqual(['block:firmware']);
        expect(rows('backups')).toEqual(['block:backups', 'import', 'export']);
    });

    it('holds Hardware, Typing behavior and every block once', () => {
        expect([...blocksOnPage()].sort()).toEqual(['about', 'backups', 'board', 'debug', 'firmware', 'hardware', 'pointing', 'power', 'typing']);
    });

    it('shows Pointing only on some boards, beside Hardware, and no Touchpad tuning card', () => {
        expect([...CONDITIONAL_SECTIONS]).toEqual(['pointing', 'power']);
        expect(SETTINGS_PAGE.findIndex((s) => s.id === 'pointing')).toBe(SETTINGS_PAGE.findIndex((s) => s.id === 'hardware') + 1);
        expect(SETTINGS_PAGE.find((s) => s.id === 'pointing')!.rows).toEqual([{ block: 'pointing' }]);
        expect(SETTINGS_PAGE.some((s) => s.id === 'touchpad')).toBe(false);
    });

    it('puts Power and scanning before About, closed by default, with its one block', () => {
        const power = SETTINGS_PAGE.find((s) => s.id === 'power')!;
        expect(SETTINGS_PAGE.findIndex((s) => s.id === 'power')).toBe(SETTINGS_PAGE.findIndex((s) => s.id === 'about') - 1);
        expect(power.defaultOpen).toBe(false);
        expect(power.rows).toEqual([{ block: 'power' }]);
    });

    it('shows Power and scanning only when the firmware carries the values, and never finds it otherwise', () => {
        expect(shownPage({ pointing: false, debugConsole: false, power: false }).some((s) => s.id === 'power')).toBe(false);
        expect(shownPage({ pointing: false, debugConsole: false, power: true }).some((s) => s.id === 'power')).toBe(true);
        expect(searchSettings(shownPage({ pointing: false, debugConsole: false, power: false }), 'deep idle', () => undefined)?.has('power') ?? false).toBe(false);
        expect(searchSettings(shownPage({ pointing: false, debugConsole: false, power: true }), 'deep idle', () => undefined)?.has('power')).toBe(true);
    });

    it('opens only Hardware and Pointing on a first visit', () => {
        expect(SETTINGS_PAGE.filter((s) => s.defaultOpen).map((s) => s.id)).toEqual(['hardware', 'pointing']);
    });

    it('keeps trackball characterization out of About: it is Pointing > Advanced > Live view', () => {
        expect(onPage).not.toContain('trackball-characterization');
        expect(SETTINGS_SHOWN_ELSEWHERE['trackball-characterization']).toMatch(/Live view/);
    });

    it('remembers Advanced and its groups like the cards: Advanced closed, its groups open', () => {
        expect(POINTING_ADVANCED.map((s) => [s.id, s.defaultOpen])).toEqual([
            ['pointing-advanced', false], ['pointing-automouse', true], ['pointing-taps', true], ['pointing-scrolling', true], ['pointing-live', true],
        ]);
        const keys = [...SETTINGS_PAGE, ...POINTING_ADVANCED].map((s) => sectionStateSetting(s.id));
        expect(new Set(keys).size).toBe(keys.length);
    });

    it('remembers each card under its own setting, Hardware under the one it already used', () => {
        expect(sectionStateSetting('hardware')).toBe(HARDWARE_OPEN_SETTING);
        expect(HARDWARE_OPEN_SETTING).toBe('settings-hardware-open');
        const keys = SETTINGS_PAGE.map((s) => sectionStateSetting(s.id));
        expect(new Set(keys).size).toBe(keys.length);
        for (const key of keys) expect(SETTINGS.find((d) => d.name === key), key).toBeUndefined();
    });
});

describe('the page a board shows', () => {
    const lookup = () => undefined;
    const debugRow = (page: ReturnType<typeof shownPage>) => page.find((s) => s.id === 'about')!.rows.some((r) => 'block' in r && r.block === 'debug');

    it('has the Debug console row and the Pointing card only when the board has them', () => {
        expect(debugRow(shownPage({ pointing: false, debugConsole: true }))).toBe(true);
        expect(debugRow(shownPage({ pointing: false, debugConsole: false }))).toBe(false);
        expect(shownPage({ pointing: false, debugConsole: true }).some((s) => s.id === 'pointing')).toBe(false);
        expect(shownPage({ pointing: true, debugConsole: true }).some((s) => s.id === 'pointing')).toBe(true);
    });

    it('never finds the Debug console row in search when the firmware has no command', () => {
        for (const query of ['debug console', 'console', 'logging']) {
            const hidden = searchSettings(shownPage({ pointing: false, debugConsole: false }), query, lookup);
            expect(hidden?.get('about')?.rows.has('block:debug') ?? false).toBe(false);
            const shown = searchSettings(shownPage({ pointing: false, debugConsole: true }), query, lookup);
            expect(shown?.get('about')?.rows.has('block:debug')).toBe(true);
        }
    });
});
