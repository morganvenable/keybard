import { describe, expect, it } from 'vitest';
import { selectPointingMenu } from '../../src/utils/pointing-menu';
import type { CustomUIMenuItem } from '../../src/types/keyboard.types';
import { SVALBOARD_POINTING_MENU } from '../fixtures/pointing-menu.fixture';

function controls(items: CustomUIMenuItem[]): CustomUIMenuItem[] {
    return items.flatMap(item => typeof item.content?.[0] === 'string'
        ? [item] : controls((item.content ?? []) as CustomUIMenuItem[]));
}

describe('Pointing / Developer control placement', () => {
    it('hides the turbo preset while keeping DPI, scrolling and conditional auto mouse controls', () => {
        const original = structuredClone(SVALBOARD_POINTING_MENU);
        const pointing = selectPointingMenu(original, 'pointing');
        const developer = selectPointingMenu(original, 'developer');
        expect(developer).toEqual([]);
        expect(controls(pointing).map(item => item.content?.[0])).toContain('id_left_automouse');
        const autoMouse = (pointing[0].content as CustomUIMenuItem[]).find(item => item.label === 'Auto Mouse');
        expect((autoMouse?.content as CustomUIMenuItem[])[1].showIf).toBe('{id_automouse_enable} == 1');
        expect([...controls(pointing), ...controls(developer)]).toHaveLength(controls(original).length - 1);
        expect(original).toEqual(SVALBOARD_POINTING_MENU);
    });

    it('places the scan limit directly before sleep without changing firmware references', () => {
        const entries: CustomUIMenuItem[] = ['id_turbo_scan', 'id_idle_cpu_sleep', 'id_scan_period_us']
            .map((key, i) => ({ type: 'range', content: [key, 1, i], options: [0, 20000] }));
        const result = controls(selectPointingMenu([{ label: 'Advanced', content: entries }], 'developer'));
        expect(result.map(item => item.content?.[0])).toEqual(['id_scan_period_us', 'id_idle_cpu_sleep']);
        expect(result[0].content).toBe(entries[2].content);
        expect(result[0].options).toBe(entries[2].options);
    });

    it('never shows the turbo preset, in any section, and starts the scan waits at 1 µs', () => {
        const menu: CustomUIMenuItem[] = [{ label: 'Advanced', content: [
            { label: 'Scan Speed', type: 'dropdown', options: ['0', '1'], content: ['id_turbo_scan', 0, 9] },
            { label: 'Pre', type: 'range', options: [0, 1000], content: ['id_scan_prewait_us', 0, 13] },
            { label: 'Post', type: 'range', options: [1, 1000], content: ['id_scan_postwait_us', 0, 14] },
        ] }];
        for (const section of ['all', 'pointing', 'developer'] as const) {
            expect(controls(selectPointingMenu(menu, section)).map(item => item.content?.[0])).not.toContain('id_turbo_scan');
        }
        const developer = controls(selectPointingMenu(menu, 'developer'));
        expect(developer.map(item => item.options)).toEqual([[1, 1000], [1, 1000]]);
        expect(developer[0].content).toBe((menu[0].content as CustomUIMenuItem[])[1].content);
        const plain: CustomUIMenuItem[] = [{ label: 'X', content: [{ type: 'toggle', content: ['id_left_scroll', 0, 1] }] }];
        expect(selectPointingMenu(plain, 'all')).toBe(plain);
    });

    it('moves trackball rest with power settings while retaining unknown pointer controls', () => {
        const keys = ['id_idle_pointer_rest', 'future_pointer_setting', 'id_idle_rgb_dim',
            'id_scan_deep_clock_idx', 'id_idle_cpu_sleep'];
        const entries: CustomUIMenuItem[] = keys.map((key, i) => ({ type: 'toggle', content: [key, 0, i] }));
        const menu: CustomUIMenuItem[] = [{ label: 'Advanced', content: entries }];
        const pointing = controls(selectPointingMenu(menu, 'pointing'));
        const developer = controls(selectPointingMenu(menu, 'developer'));
        expect(pointing.map(item => item.content?.[0])).toEqual(['future_pointer_setting']);
        expect(developer.map(item => item.content?.[0])).toEqual([keys[4], keys[0], keys[2], keys[3]]);
        // Keep the exact value references/options used by USB read/write and persistence.
        expect(developer[1].content).toBe(entries[0].content);
        expect(developer[1].label).toBe("Trackball power saving");
        expect(developer[1].description).toContain("Movement wakes it automatically");
        expect(selectPointingMenu([{ label: 'Advanced', content: [entries[2]] }], 'pointing')).toEqual([]);
    });
});
