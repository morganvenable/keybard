import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import SlotKey from '../../src/layout/SecondarySidebar/components/BindingEditor/EditorKey';
import PaletteKey from '../../src/layout/SecondarySidebar/components/EditorKey';

// Color roles on the binding-editor slots and palette keys (docs/practice/spec.md
// §5.17, mockup M-37). These render the real components, because the class order
// (which strip text color wins) is decided by tailwind-merge at render time and a
// source grep can't see it.

const drag = { isDragging: false, dragSourceId: null as string | null, draggedItem: null as unknown };

vi.mock('@/contexts/DragContext', () => ({
    useDrag: () => ({
        ...drag,
        startDrag: vi.fn(),
        markDropConsumed: vi.fn(),
    }),
}));
vi.mock('@/contexts/KeyboardContext', () => ({ useKeyboard: () => ({ keyboard: { cosmetic: { layer_colors: ['green'] } } }) }));
vi.mock('@/contexts/LayerContext', () => ({ useLayer: () => ({ selectedLayer: 0 }) }));
vi.mock('@/contexts/LayoutSettingsContext', () => ({
    useLayoutSettings: () => ({ internationalLayout: 'us', keyVariant: 'default', layoutMode: 'sidebar' }),
}));
// A slot is isRelative, so the real useKeyDrag never reports a drag hover for it:
// the slot's own mouse handlers track that. Mirror that here.
vi.mock('@/hooks/useKeyDrag', () => ({
    useKeyDrag: () => ({
        isDragHover: false,
        isDragSource: false,
        currentUnitSize: 60,
        handleMouseEnter: () => {},
        handleMouseLeave: () => {},
        handleMouseDown: () => {},
        handleMouseUp: () => {},
    }),
}));
// A layer-tap binding: it has a header strip, where the strip text color matters.
vi.mock('@/utils/keys', () => ({ getKeyContents: () => ({ type: 'layerhold', str: 'A', top: 'LT1' }) }));
vi.mock('@/services/key.service', () => ({ keyService: { canonical: (k: string) => k } }));

const classesOf = (el: Element) => el.className.split(/\s+/);
const RED = /(^|:)!?(bg|ring|border|outline)-(red-\d+|kb-red)/;

beforeEach(() => {
    drag.isDragging = false;
    drag.dragSourceId = null;
    drag.draggedItem = null;
});

/** Renders a slot and returns its wrapper (the drag-hover target), the key face and its header strip. */
function renderSlot(props: { selected?: boolean; onDrop?: () => void } = {}) {
    const { container } = render(<SlotKey keycode="LT1(KC_A)" onClick={() => {}} {...props} />);
    const wrapper = container.querySelector('.group\\/editorkey') as HTMLElement;
    const face = wrapper.firstElementChild as HTMLElement;
    const strip = face.querySelector('span') as HTMLElement;
    return { wrapper, face, strip };
}

describe('binding editor slot color roles', () => {
    it('selected: 2px select border on the tint, no ring (mockup .slotk.n-sel)', () => {
        const { face, strip } = renderSlot({ selected: true });
        const cls = classesOf(face);
        expect(cls).toEqual(expect.arrayContaining(['border-2', 'border-kb-select', 'bg-kb-select-tint', 'text-kb-ink', 'ring-0', 'ring-offset-0']));
        expect(cls).not.toContain('ring-2');
        expect(cls).not.toContain('ring-offset-1');
        expect(classesOf(strip)).toEqual(expect.arrayContaining(['bg-kb-select-strip', 'text-kb-ink']));
        expect(classesOf(strip)).not.toContain('text-white');
        expect(cls.filter((c) => RED.test(c))).toEqual([]);
    });

    it('drag hover over a slot that takes drops: selected look, ink on the light strip (mockup .slotk.n-drag)', () => {
        drag.isDragging = true;
        const { wrapper } = renderSlot({ onDrop: () => {} });
        fireEvent.mouseEnter(wrapper);
        const face = wrapper.firstElementChild as HTMLElement;
        const strip = face.querySelector('span') as HTMLElement;
        expect(classesOf(face)).toEqual(expect.arrayContaining(['bg-kb-select-tint', 'text-kb-ink', 'ring-2', 'ring-kb-select', 'ring-offset-1']));
        expect(classesOf(strip)).toEqual(expect.arrayContaining(['bg-kb-select-strip', 'text-kb-ink']));
        // White on kb-select-strip is about 1.4:1 in light theme.
        expect(classesOf(strip)).not.toContain('text-white');
        expect(classesOf(face).filter((c) => RED.test(c))).toEqual([]);
    });

    it('a filled slot that is neither selected nor a drop target keeps the dark strip with white text', () => {
        drag.isDragging = true;
        const { wrapper, face, strip } = renderSlot(); // no onDrop: never a drop target
        fireEvent.mouseEnter(wrapper);
        expect(classesOf(face)).not.toContain('bg-kb-select-tint');
        expect(classesOf(strip)).toEqual(expect.arrayContaining(['bg-kb-sidebar-dark', 'text-white']));
    });
});

describe('palette key color roles', () => {
    const binding = { str: 'A', keycode: 'KC_A', type: 'keyboard' };
    const face = (container: HTMLElement) => container.querySelector('.rounded-md') as HTMLElement;

    it('selected: tint face, select border, ink legend', () => {
        const { container } = render(<PaletteKey binding={binding} selected />);
        const cls = classesOf(face(container));
        expect(cls).toEqual(expect.arrayContaining(['!bg-kb-select-tint', 'border-kb-select', 'text-kb-ink']));
        expect(cls).not.toContain('text-white');
    });

    it('drag hover: tint face, select border, ink legend (white on the tint is about 1.2:1)', () => {
        drag.isDragging = true;
        const { container } = render(<PaletteKey binding={binding} onDrop={() => {}} />);
        fireEvent.mouseEnter(face(container));
        const cls = classesOf(face(container));
        expect(cls).toEqual(expect.arrayContaining(['!bg-kb-select-tint', '!border-kb-select', 'text-kb-ink']));
        expect(cls).not.toContain('text-white');
        expect(cls.filter((c) => RED.test(c))).toEqual([]);
    });

    it('hover previews the select border, not red', () => {
        const { container } = render(<PaletteKey binding={binding} />);
        const cls = classesOf(face(container));
        expect(cls).toContain('hover:border-kb-select');
        expect(cls.filter((c) => RED.test(c))).toEqual([]);
    });
});
