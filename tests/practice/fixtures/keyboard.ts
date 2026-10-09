// A small fake Svalboard keyboard for keybr's ported tests (spec §9.2): the default
// keymap through the resolver and the adapter, standing in for keybr's
// loadKeyboard(Layout.EN_US), whose layout tables are not vendored.
import { resolveKeymap } from '@/features/practice/keymap/resolver';
import { svalKeyboard, type SvalKeyboard } from '@/features/practice/keymap/svalKeyboard';
import { svalDefault } from './boards';

let cached: SvalKeyboard | null = null;

export function fakeSvalKeyboard(): SvalKeyboard {
    if (!cached) {
        const board = svalDefault();
        cached = svalKeyboard(board, resolveKeymap({ keymap: board.keymap!, rows: board.rows, cols: board.cols }));
    }
    return cached;
}
