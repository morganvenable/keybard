// Practice test fixtures: the default Svalboard keymap as Keybard loads it.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileService } from '@/services/file.service';
import type { KeyboardInfo } from '@/types/keyboard.types';

const SVAL_DEFAULT = resolve(__dirname, '../../../src/default-layouts/sval-default.svil');

/** src/default-layouts/sval-default.svil parsed by Keybard's file loader. */
export function svalDefault(): KeyboardInfo {
    // The file loader logs its layout composition; keep test output quiet.
    const log = console.log;
    console.log = () => {};
    try {
        return fileService.parseContent(readFileSync(SVAL_DEFAULT, 'utf8'));
    } finally {
        console.log = log;
    }
}

/** A copy of a board with one position rebound on one layer. */
export function rebind(board: KeyboardInfo, layer: number, index: number, code: number): KeyboardInfo {
    const keymap = board.keymap!.map((l) => [...l]);
    keymap[layer][index] = code;
    return { ...board, keymap };
}
