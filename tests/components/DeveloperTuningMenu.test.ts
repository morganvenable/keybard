import { describe, expect, it } from 'vitest';

import { isExcludedMenu } from '../../src/constants/custom-ui-exclusions';
import { developerTuningMenuIndex } from '../../src/layout/SecondarySidebar/Panels/DeveloperTuningSection';
import type { CustomUIMenuItem } from '../../src/types/keyboard.types';

const idle = { label: 'Deep Idle After (s)', type: 'range', options: [0, 3600], content: ['id_scan_deep_after_s', 0, 30] };
const dpi = { label: 'DPI', type: 'dropdown', options: ['200', '400'], content: ['id_left_dpi', 0, 0] };

describe('Settings > Power and scanning finds the firmware values', () => {
    it('under Pointing Device > Advanced on older firmware', () => {
        const menus = [{ label: 'Pointing Device', content: [{ label: 'Left Pointer', content: [dpi] }, { label: 'Advanced', content: [idle] }] }] as CustomUIMenuItem[];
        expect(developerTuningMenuIndex(menus)).toBe(0);
    });

    it('in the top-level Power and scanning menu of newer firmware, which stays off the rail', () => {
        const menus = [
            { label: 'Pointing Device', content: [{ label: 'Left Pointer', content: [dpi] }] },
            { label: 'Power and scanning', content: [{ label: 'Power and scanning', content: [idle] }] },
        ] as CustomUIMenuItem[];
        expect(developerTuningMenuIndex(menus)).toBe(1);
        expect(isExcludedMenu('Power and scanning')).toBe(true);
    });

    it('nowhere when no menu has them', () => {
        expect(developerTuningMenuIndex([{ label: 'Pointing Device', content: [dpi] }] as CustomUIMenuItem[])).toBe(-1);
        expect(developerTuningMenuIndex(undefined)).toBe(-1);
    });
});
