import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LayersPanel from '@/layout/SecondarySidebar/Panels/LayersPanel';

const { assignKeycode } = vi.hoisted(() => ({ assignKeycode: vi.fn() }));
vi.mock('@/hooks/useLayerNames', () => ({ useLayerNames: () => ({ renameLayer: vi.fn() }) }));
vi.mock('@/contexts/KeyBindingContext', () => ({ useKeyBinding: () => ({ assignKeycode }) }));
vi.mock('@/contexts/LayerContext', () => ({ useLayer: () => ({ selectedLayer: 0 }) }));
vi.mock('@/contexts/LayoutSettingsContext', () => ({ useLayoutSettings: () => ({ layoutMode: 'bottombar' }) }));
vi.mock('@/contexts/KeyboardContext', () => ({ useKeyboard: () => ({ keyboard: { layers: 16, cosmetic: {} } }) }));
vi.mock('@/services/sval.service', () => ({ svalService: { getLayerCosmetic: () => '' } }));
vi.mock('@/utils/keys', () => ({ getKeyContents: () => ({}) }));
vi.mock('@/components/Key', () => ({ Key: ({ keycode, onClick }: { keycode: string; onClick: () => void }) => <button onClick={onClick}>{keycode}</button> }));

describe('bottom Layer Keys palette', () => {
    it('keeps all layer choices available while changing the layer action', () => {
        render(<LayersPanel />);
        expect(screen.getByRole('button', { name: 'MO' })).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(screen.getByRole('button', { name: 'TG', exact: true }));
        expect(screen.getByRole('button', { name: 'TG', exact: true })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'MO', exact: true })).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getAllByRole('button', { name: /^TG\(\d+\)$/ })).toHaveLength(16);
        fireEvent.click(screen.getByRole('button', { name: 'TG(15)', exact: true }));
        expect(assignKeycode).toHaveBeenCalledWith('TG(15)');
        fireEvent.click(screen.getByRole('button', { name: 'LT', exact: true }));
        expect(screen.getByRole('button', { name: 'LT15(KC_NO)', exact: true })).toBeInTheDocument();
    });
});
