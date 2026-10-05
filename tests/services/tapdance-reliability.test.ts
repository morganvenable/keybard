import { describe, it, expect, vi } from 'vitest';
import { TapdanceService } from '../../src/services/tapdance.service';
import { SvilUSB } from '../../src/services/usb.service';
import { fileService } from '../../src/services/file.service';
import type { KeyboardInfo } from '../../src/types/vial.types';
const keyboard = (enabled: boolean | undefined, term = 0): KeyboardInfo => ({ rows: 1, cols: 1, layers: 1, keymap: [[4]], tapdances: [{ idx: 0, tap: 'KC_A', hold: 'KC_B', doubletap: 'KC_C', taphold: 'KC_D', tapping_term: term, enabled }] });
describe('tap dance save fidelity', () => {
    it.each([[false, 0, 0], [true, 0, 32768], [undefined, 200, 32968], [false, -20, 0], [false, 40000, 32767]] as const)('writes enabled=%s term=%s as %s', async (enabled, term, expected) => {
        const sendSvil = vi.fn().mockResolvedValue(new Uint8Array([SvilUSB.CMD_SVIL_TAP_DANCE_SET, 0]));
        const service = new TapdanceService({ sendSvil, svilProtocolVersion: 3 } as unknown as SvilUSB);
        await service.push(keyboard(enabled, term), 0);
        const bytes = sendSvil.mock.calls[0][1];
        expect(bytes.slice(-2)).toEqual([expected & 255, expected >> 8]);
    });
    it('preserves disabled status and zero timing through a native backup', () => {
        const exported = fileService.kbinfoToSvil(keyboard(false));
        const imported = fileService.parseContent(exported);
        expect(imported.tapdances?.[0]).toMatchObject({ enabled: false, tapping_term: 0 });
    });
});
