import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { Key, type KeyProps } from '../../src/components/Key';

// Color roles on key caps (docs/practice/spec.md §5.0.1, §5.17): selected and
// drop-target keys use the select role, pending keys the dashed amber border,
// and nothing in a key's normal states is red.

const dragState = { isDragHover: false, isDragSource: false };

vi.mock('@/contexts/LayoutSettingsContext', () => ({
    useLayoutSettings: () => ({ internationalLayout: 'us', keyVariant: 'default', layoutMode: 'sidebar' }),
}));
vi.mock('@/hooks/useKeyDrag', () => ({
    useKeyDrag: () => ({
        ...dragState,
        currentUnitSize: 60,
        handleMouseEnter: () => {},
        handleMouseLeave: () => {},
        handleMouseDown: () => {},
        handleMouseUp: () => {},
    }),
}));

/** Renders a key with a header strip (a layer-tap key has a top label) and returns its root element. */
function renderKey(props: Partial<KeyProps> = {}) {
    const { container } = render(
        <Key x={0} y={0} w={1} h={1} row={0} col={0} keycode="KC_A" label="A"
             keyContents={{ type: 'layerhold', str: 'A', top: 'LT1' } as KeyProps['keyContents']}
             layerColor="green" disableTooltip {...props} />
    );
    return container.firstElementChild as HTMLElement;
}

const classesOf = (el: Element) => el.className.split(/\s+/);
const RED = /(^|:)!?(bg|ring|border|outline)-(red-\d+|kb-red)/;

beforeEach(() => {
    dragState.isDragHover = false;
    dragState.isDragSource = false;
});

describe('Key color roles', () => {
    it('selected: select tint face, ink legend, ring outside with an offset, painted over neighbors', () => {
        const cls = classesOf(renderKey({ selected: true }));
        expect(cls).toEqual(expect.arrayContaining([
            'z-10', 'bg-kb-select-tint', 'text-kb-ink', 'ring-2', 'ring-kb-select', 'ring-offset-1', 'ring-offset-background',
        ]));
        expect(cls).not.toContain('bg-kb-green');
        expect(cls.filter((c) => RED.test(c))).toEqual([]);
    });

    it('selected: header and footer strips turn light with ink text', () => {
        const el = renderKey({ selected: true });
        const strip = el.querySelector('span') as HTMLElement;
        expect(classesOf(strip)).toEqual(expect.arrayContaining(['bg-kb-select-strip', 'text-kb-ink', 'group-hover:bg-kb-select-strip']));
        expect(classesOf(strip)).not.toContain('text-white');
        expect(classesOf(strip)).not.toContain('bg-black/30');
    });

    it('unselected strips keep the layer header (bg-black/30, white text)', () => {
        const strip = renderKey().querySelector('span') as HTMLElement;
        expect(classesOf(strip)).toEqual(expect.arrayContaining(['bg-black/30', 'text-white']));
    });

    it('drag hover (drop target) uses the selected look', () => {
        dragState.isDragHover = true;
        const cls = classesOf(renderKey());
        expect(cls).toEqual(expect.arrayContaining(['bg-kb-select-tint', 'ring-kb-select']));
    });

    it('default hover is a select ring outside the key, not an inset red ring', () => {
        const cls = classesOf(renderKey());
        expect(cls).toEqual(expect.arrayContaining([
            'hover:z-10', 'hover:ring-2', 'hover:ring-kb-select', 'hover:ring-offset-1', 'hover:ring-offset-background',
        ]));
        expect(cls).not.toContain('hover:ring-inset');
        expect(cls.filter((c) => RED.test(c))).toEqual([]);
    });

    it('a caller-supplied hover border replaces the default ring', () => {
        const cls = classesOf(renderKey({ hoverBorderColor: 'hover:border-kb-primary' }));
        expect(cls).toContain('hover:border-kb-primary');
        expect(cls).not.toContain('hover:ring-kb-select');
    });

    it('pending: dashed amber border on the layer face', () => {
        const cls = classesOf(renderKey({ hasPendingChange: true }));
        expect(cls).toEqual(expect.arrayContaining(['border-2', 'border-dashed', 'border-kb-pending', 'bg-kb-green']));
        expect(cls.filter((c) => RED.test(c))).toEqual([]);
    });

    it('pending and selected: shows both the ring and the dashed border', () => {
        const cls = classesOf(renderKey({ hasPendingChange: true, selected: true }));
        expect(cls).toEqual(expect.arrayContaining([
            'ring-2', 'ring-kb-select', 'bg-kb-select-tint', 'border-2', 'border-dashed', 'border-kb-pending',
        ]));
        expect(cls).not.toContain('border-kb-key-border');
    });

    it('selectedStrong (Matrix Tester held): strong blue face under a 3 px ring', () => {
        const cls = classesOf(renderKey({ selectedStrong: true, layerColor: 'white', disableHover: true }));
        expect(cls).toEqual(expect.arrayContaining([
            'z-10', 'bg-kb-select-strong', 'ring-[3px]', 'ring-kb-select', 'ring-offset-2', 'ring-offset-background',
        ]));
        expect(cls).not.toContain('bg-white');
    });

    it('the layer-key renderer uses the same roles', () => {
        const { container } = render(
            <Key x={0} y={0} w={1} h={1} row={0} col={0} keycode="MO(1)" label="MO(1)"
                 keyContents={{ type: 'layer', top: 'MO(1)', layertext: 'MO' } as KeyProps['keyContents']}
                 selected hasPendingChange disableTooltip />
        );
        const cls = classesOf(container.firstElementChild as Element);
        expect(cls).toEqual(expect.arrayContaining(['bg-kb-select-tint', 'ring-kb-select', 'border-dashed', 'border-kb-pending']));
        const strip = (container.firstElementChild as Element).querySelector('span') as HTMLElement;
        expect(classesOf(strip)).toContain('bg-kb-select-strip');
    });
});
