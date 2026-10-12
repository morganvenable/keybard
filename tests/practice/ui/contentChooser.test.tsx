import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ContentChooser } from '@/features/practice/ui/ContentChooser';
import { svalDefault } from '../fixtures/boards';
import { resetHarness, startController } from './harness';

afterEach(() => { cleanup(); resetHarness(); });
it('warns when generated number practice contains digits absent from the board', async () => {
    const board = svalDefault();
    board.keymap = board.keymap!.map(layer => layer.map(code => {
        const basic = code & 0xff;
        return (basic >= 0x1e && basic <= 0x27) || (basic >= 0x59 && basic <= 0x62) ? 0 : code;
    }));
    const c = await startController({ keymap: { board } });
    c.update({ type: 'numbers' });
    await vi.waitFor(() => expect(c.session?.type).toBe('numbers'));
    render(<ContentChooser controller={c} onMore={() => {}} />);
    expect(screen.getByText(/Not on this keymap:/)).toHaveTextContent(/\d/);
});
