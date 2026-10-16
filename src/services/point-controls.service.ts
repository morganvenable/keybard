import { SvilUSB, usbInstance } from './usb.service';
import { type PointControls, validatePointControls, encodePointControls, decodePointControls } from '@/constants/point-controls';

export interface PointStatus { left: number; right: number; axes: number; locked: boolean; session: boolean; multiplier: number; recognized: number; admitted: number; dropped: number }
export class PointControlsService {
    private generation: number | null = null;
    private version = 1;
    constructor(private usb: SvilUSB) {}
    private decode(reply: Uint8Array, command: number): PointControls {
        if (reply.length < 21 || reply[0] !== command || ![1,2,3,4,5].includes(reply[2])) throw new Error('Pointing tools need matching keyboard firmware.');
        const errors: Record<number, string> = {
            1: 'Stop active pointing tools before saving their settings.',
            2: 'Pointing settings changed in another window. Reload the keyboard before trying again.',
            3: 'The keyboard rejected those motion settings.',
            4: 'The keyboard could not save the pointing settings. Reconnect and try again.',
        };
        if (reply[1]) throw new Error(errors[reply[1]] ?? 'Could not save pointing tools.');
        const value: PointControls = reply[2] !== 1 ? decodePointControls(reply.slice(5,reply[2]>=4?24:21),reply[2] as 2|3|4|5) : { version: 1, profiles: Array.from({length: 4}, (_, i) => ({
            distance: reply[5+i*4] | reply[6+i*4] << 8, interval: reply[7+i*4], reversal: reply[8+i*4],
        })) };
        validatePointControls(value);
        this.version = reply[2];
        this.generation = reply[3] | reply[4] << 8;
        return value;
    }
    async load(): Promise<PointControls> {
        this.generation = null;
        return this.decode(await this.usb.sendSvil(SvilUSB.CMD_SVIL_POINT_TOOLS_GET, [], {uint8: true}), SvilUSB.CMD_SVIL_POINT_TOOLS_GET);
    }
    async save(value: PointControls): Promise<void> {
        validatePointControls(value);
        if (this.generation === null) throw new Error('Reconnect the keyboard to load its pointing settings first.');
        if (value.version !== this.version) throw new Error('Update the keyboard firmware and reconnect to save these settings.');
        const args = [value.version, this.generation & 255, this.generation >> 8,
            ...(value.version !== 1 ? encodePointControls(value) : value.profiles.flatMap(p => [p.distance & 255, p.distance >> 8, p.interval, p.reversal]))];
        const actual = this.decode(await this.usb.sendSvil(SvilUSB.CMD_SVIL_POINT_TOOLS_SET, args, {uint8: true}), SvilUSB.CMD_SVIL_POINT_TOOLS_SET);
        if (value.version !== 1 && JSON.stringify(encodePointControls(actual)) !== JSON.stringify(encodePointControls(value))) throw new Error('Pointing settings readback did not match.');
        if (value.version === 1 && actual.profiles.some((p, i) => p.distance !== value.profiles[i].distance || p.interval !== value.profiles[i].interval || p.reversal !== value.profiles[i].reversal)) throw new Error('Pointing settings readback did not match. Reconnect before trying again.');
    }
    async stop(): Promise<void> {
        const r = await this.usb.sendSvil(SvilUSB.CMD_SVIL_POINT_TOOLS_STOP, [], {uint8: true});
        if (r[0] !== SvilUSB.CMD_SVIL_POINT_TOOLS_STOP || r[1] !== 0 || r[2] !== 1) throw new Error('The keyboard did not confirm stopping the controls.');
    }
    async status(): Promise<PointStatus> {
        const r = await this.usb.sendSvil(SvilUSB.CMD_SVIL_POINT_TOOLS_STATUS, [], {uint8: true});
        if (r.length < 20 || r[0] !== SvilUSB.CMD_SVIL_POINT_TOOLS_STATUS || r[1] !== 1) throw new Error('Pointing status is unavailable.');
        const u32 = (n: number) => (r[n] | r[n+1]<<8 | r[n+2]<<16 | r[n+3]<<24) >>> 0;
        return { left:r[2], right:r[3], axes:r[4], locked:!!r[5], session:!!r[6], multiplier:2 ** r[7] / 2, recognized:u32(8), admitted:u32(12), dropped:u32(16) };
    }
}
export const pointControlsService = new PointControlsService(usbInstance);
