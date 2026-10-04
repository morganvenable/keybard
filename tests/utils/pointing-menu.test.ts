import { describe, expect, it } from 'vitest';
import { selectPointingMenu } from '../../src/utils/pointing-menu';
import type { CustomUIMenuItem } from '../../src/types/vial.types';
import { SVALBOARD_POINTING_MENU } from '../fixtures/pointing-menu.fixture';

function controls(items: CustomUIMenuItem[]): CustomUIMenuItem[] {
    return items.flatMap(item => typeof item.content?.[0] === 'string'
        ? [item] : controls((item.content ?? []) as CustomUIMenuItem[]));
}

describe('Pointing / Developer control placement', () => {
    it('moves scan speed while keeping DPI, scrolling and conditional auto mouse controls', () => {
        const original = structuredClone(SVALBOARD_POINTING_MENU);
        const pointing = selectPointingMenu(original, 'pointing');
        const developer = selectPointingMenu(original, 'developer');
        expect(controls(developer).map(item => item.content?.[0])).toEqual(['id_turbo_scan']);
        expect(controls(pointing).map(item => item.content?.[0])).toContain('id_left_automouse');
        const autoMouse = (pointing[0].content as CustomUIMenuItem[]).find(item => item.label === 'Auto Mouse');
        expect((autoMouse?.content as CustomUIMenuItem[])[1].showIf).toBe('{id_automouse_enable} == 1');
        expect([...controls(pointing), ...controls(developer)]).toHaveLength(controls(original).length);
        expect(original).toEqual(SVALBOARD_POINTING_MENU);
    });

    it('moves trackball rest with power settings while retaining unknown pointer controls', () => {
        const keys = ['id_idle_pointer_rest', 'future_pointer_setting', 'id_idle_rgb_dim',
            'id_scan_deep_clock_idx', 'id_idle_cpu_sleep'];
        const entries: CustomUIMenuItem[] = keys.map((key, i) => ({ type: 'toggle', content: [key, 0, i] }));
        const menu: CustomUIMenuItem[] = [{ label: 'Advanced', content: entries }];
        const pointing = controls(selectPointingMenu(menu, 'pointing'));
        const developer = controls(selectPointingMenu(menu, 'developer'));
        expect(pointing.map(item => item.content?.[0])).toEqual(['future_pointer_setting']);
        expect(developer.map(item => item.content?.[0])).toEqual([keys[0], ...keys.slice(2)]);
        // Keep the exact value references/options used by USB read/write and persistence.
        expect(developer[0].content).toBe(entries[0].content);
        expect(developer[0].label).toBe("Trackball power saving");
        expect(developer[0].description).toContain("Movement wakes it automatically");
        expect(selectPointingMenu([{ label: 'Advanced', content: [entries[2]] }], 'pointing')).toEqual([]);
    });
});
