// The updater transport over Keybard's open WebHID connection (usb.service).

import { ClientIdRejectedError, usbInstance, type SvilUSB } from "../usb.service";
import { decodeReply, encodeViaPayload } from "./protocol";
import { ClientRejectedError, DisconnectedError, ReplyTimeoutError, type UpdaterRequest, type UpdaterTransport } from "./transport";

/** Round trips measured over WebHID, for update-technical.md 1.9. */
export interface RoundTripStats {
    count: number;
    totalMs: number;
    maxMs: number;
}

export class WebHidUpdaterTransport implements UpdaterTransport {
    readonly stats: RoundTripStats = { count: 0, totalMs: 0, maxMs: 0 };

    constructor(private readonly usb: SvilUSB = usbInstance, private readonly timeoutMs = 1000) {}

    connected(): boolean {
        return this.usb.isOpen();
    }

    clientId(): number {
        return this.usb.currentClientId();
    }

    ensureClient(): Promise<number> {
        if (!this.usb.isOpen()) return Promise.reject(new DisconnectedError());
        return this.usb.ensureClient();
    }

    renewClient(): Promise<number> {
        if (!this.usb.isOpen()) return Promise.reject(new DisconnectedError());
        return this.usb.renewClient();
    }

    onClientRenewed(listener: (id: number, old: number) => void): () => void {
        return this.usb.onClientRenewed(listener);
    }

    onDisconnect(listener: () => void): () => void {
        return this.usb.addDisconnectListener(listener);
    }

    /** A failed send as the updater's errors. */
    private mapError(error: unknown, op: number): unknown {
        if (error instanceof ClientIdRejectedError) return new ClientRejectedError(error.code);
        if (!this.usb.isOpen()) return new DisconnectedError();
        if (error instanceof Error && /timeout/i.test(error.message)) return new ReplyTimeoutError(op);
        if (error instanceof Error && /not connected|closed|must be opened|NotFoundError|InvalidStateError/i.test(`${error.name} ${error.message}`)) return new DisconnectedError(error.message);
        return error;
    }

    async requestMany(requests: UpdaterRequest[], inFlight?: number) {
        if (!this.usb.isOpen()) throw new DisconnectedError();
        const t0 = performance.now();
        let reports: Uint8Array[];
        try {
            reports = await this.usb.sendUpdaterReports(requests.map((r) => encodeViaPayload(r.op, r.hand, r.args)), 3, this.timeoutMs, inFlight);
        } catch (error) {
            throw this.mapError(error, requests[0]?.op ?? 0);
        }
        const ms = performance.now() - t0;
        this.stats.count += 1;
        this.stats.totalMs += ms;
        this.stats.maxMs = Math.max(this.stats.maxMs, ms);
        return reports.map(decodeReply);
    }

    async request(op: number, hand: number, args: ArrayLike<number> = []) {
        if (!this.usb.isOpen()) throw new DisconnectedError();
        const t0 = performance.now();
        let report: Uint8Array;
        try {
            report = await this.usb.sendUpdaterReport(encodeViaPayload(op, hand, args), 3, this.timeoutMs);
        } catch (error) {
            throw this.mapError(error, op);
        }
        const ms = performance.now() - t0;
        this.stats.count += 1;
        this.stats.totalMs += ms;
        this.stats.maxMs = Math.max(this.stats.maxMs, ms);
        return decodeReply(report);
    }
}
