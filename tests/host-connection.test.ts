import { afterEach, describe, expect, it, vi } from 'vitest';
import { getKeyContents } from '../src/utils/keys';
import { connectHostKeyboard, hostKeyboards } from '../src/features/trainer/hostConnection';
const board = { rows: 10, cols: 6, name: 'Main', keymap: [Array(60).fill(4)] };
const connected = { apiVersion: 1, selectedDevice: 'main', valid: true, board, devices: [{ id: 'main', name: 'Main' }, { id: 'mule', name: 'Mule' }], status: 'Connected' };
afterEach(() => { vi.unstubAllGlobals(); });
function reply(data: unknown) { return new Response(JSON.stringify(data), { status: 200 }); }
describe('Host keyboard connection', () => {
    it('renders a tap-dance reference when a snapshot omits its definition', () => {
        expect(() => getKeyContents(board, 'TD(4)')).not.toThrow();
    });
    it('loads the selected board without reconnecting or any write command', async () => {
        const fetch = vi.fn().mockResolvedValue(reply(connected)); vi.stubGlobal('fetch', fetch);
        const result = await connectHostKeyboard();
        expect(result).toEqual(board);
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch.mock.calls[0][0]).toBe('/api/host/state?layout=-1');
    });
    it('lists every board with stable host IDs', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(connected)));
        expect((await hostKeyboards()).map(d => d.hostId)).toEqual(['main', 'mule']);
    });
    it('requires selection when multiple boards exist and none is selected', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ ...connected, selectedDevice: null, valid: false, board: null })));
        await expect(connectHostKeyboard()).rejects.toThrow('Select a keyboard');
    });
    it('waits for the requested board instead of returning the previous layout', async () => {
        const fetch = vi.fn().mockResolvedValueOnce(reply(connected)).mockResolvedValueOnce(reply({ token: 'token' })).mockResolvedValueOnce(reply({ accepted: true })).mockResolvedValueOnce(reply({ ...connected, selectedDevice: 'mule', board: { ...board, name: 'Mule' } }));
        vi.stubGlobal('fetch', fetch);
        expect((await connectHostKeyboard('mule')).name).toBe('Mule');
        expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({ op: 'connect', id: 'mule' });
    });
    it('rejects unreachable hosts rather than reporting success', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
        await expect(connectHostKeyboard()).rejects.toThrow('Could not reach');
    });
});
