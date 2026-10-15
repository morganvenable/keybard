/**
 * The editor's key must render the same before and after KeyFace was extracted from it:
 * these snapshots were taken from Key before the refactor and must not change.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Key } from '../../src/components/Key';
import type { KeyContent } from '../../src/types/keyboard.types';

vi.mock('@/contexts/LayoutSettingsContext', () => ({
    useLayoutSettings: () => ({ internationalLayout: 'us', keyVariant: 'default', layoutMode: 'sidebar' }),
}));
vi.mock('@/hooks/useKeyDrag', () => ({
    useKeyDrag: ({ unitSize }: { unitSize?: number }) => ({
        isDragSource: false, isDragHover: false, currentUnitSize: unitSize ?? 60,
        handleMouseEnter: () => {}, handleMouseLeave: () => {}, handleMouseDown: () => {}, handleMouseUp: () => {},
    }),
}));

type Case = [string, { keycode: string; label: string; keyContents?: KeyContent; layerColor?: string; selected?: boolean; variant?: 'default' | 'medium' | 'small'; hasPendingChange?: boolean }];
const CASES: Case[] = [
    ['basic', { keycode: 'KC_A', label: 'A', layerColor: 'green' }],
    ['layer', { keycode: 'MO(2)', label: 'MO(2)', layerColor: 'blue', keyContents: { type: 'layer', top: 'MO(2)', layertext: 'MO' } as KeyContent }],
    ['mod-tap', { keycode: 'LSFT_T(KC_F)', label: 'F', layerColor: 'purple', keyContents: { type: 'modtap', top: 'LSFT_T', str: 'F' } as KeyContent }],
    ['custom hex color', { keycode: 'KC_B', label: 'B', layerColor: '#450770' }],
    ['transparent', { keycode: 'KC_TRNS', label: '▽', layerColor: 'orange' }],
    ['selected small', { keycode: 'KC_ENTER', label: 'Enter', layerColor: 'red', selected: true, variant: 'small' }],
    ['pending medium', { keycode: 'KC_SPACE', label: 'Space', layerColor: 'yellow', hasPendingChange: true, variant: 'medium' }],
];

describe('Key renders the same as before KeyFace', () => {
    for (const [name, props] of CASES) {
        it(name, () => {
            const { container } = render(<Key x={1} y={2} w={1} h={1} row={0} col={0} {...props} />);
            expect(container.innerHTML).toMatchSnapshot();
        });
    }
});
