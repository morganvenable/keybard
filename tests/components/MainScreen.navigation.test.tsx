import { afterEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MainScreen from '../../src/components/MainScreen';
const state = vi.hoisted(() => ({ keyboard: null as object | null }));
vi.mock('@/contexts/KeyboardContext', () => ({ useKeyboard: () => state }));
vi.mock('@/layout/EditorLayout', () => ({ default: () => <div>Editor workspace</div> }));
vi.mock('../../src/components/ConnectKeyboard', () => ({ default: () => <button>Connect Keyboard</button> }));
afterEach(() => { window.location.hash = ''; state.keyboard = null; });
it('requires the normal connection flow even when the URL requests Trainer', () => {
    window.location.hash = '#trainer';
    const { rerender } = render(<MainScreen />);
    expect(screen.getByRole('button', { name: 'Connect Keyboard' })).toBeInTheDocument();
    expect(screen.queryByText('Editor workspace')).not.toBeInTheDocument();
    state.keyboard = { rows: 10, cols: 6 };
    rerender(<MainScreen />);
    expect(screen.getByText('Editor workspace')).toBeInTheDocument();
});
