// The touchpad prototype controls' board calls (dev firmware only): see
// src/utils/ptp-prototype.ts for the bytes.
import { usbInstance } from "@/services/usb.service";
import {
    parseProtoReply, protoGetPayload, protoRebootPayload, protoSetPayload, PROTO_STATUS_OK,
    type ProtoConfig, type ProtoReply, type ProtoState,
} from "@/utils/ptp-prototype";

export interface ProtoTransport {
    sendDev(payload: number[], timeoutMs?: number): Promise<Uint8Array>;
}

export type ProtoSetResult = { ok: true; state: ProtoState } | { ok: false; state: ProtoState | null };

export class PtpPrototypeService {
    constructor(private readonly usb: ProtoTransport = usbInstance) {}

    private async call(payload: number[]): Promise<ProtoReply | null> {
        try {
            return parseProtoReply(await this.usb.sendDev(payload));
        } catch {
            // A wrapper error frame, a timeout or no board: not supported.
            return null;
        }
    }

    /** The board's prototype state, or null when it doesn't have the command (or the block). */
    async get(): Promise<ProtoState | null> {
        const reply = await this.call(protoGetPayload());
        return reply && reply.status === PROTO_STATUS_OK ? reply.state : null;
    }

    /** Writes all four values; the reply's block is the board's state either way. */
    async set(config: ProtoConfig): Promise<ProtoSetResult> {
        const reply = await this.call(protoSetPayload(config));
        if (reply && reply.status === PROTO_STATUS_OK && reply.state) return { ok: true, state: reply.state };
        return { ok: false, state: reply?.state ?? null };
    }

    /** The board restarts about 200 ms after it answers. */
    async reboot(): Promise<boolean> {
        const reply = await this.call(protoRebootPayload());
        return !!reply && reply.status === PROTO_STATUS_OK;
    }
}

export const ptpPrototype = new PtpPrototypeService();
