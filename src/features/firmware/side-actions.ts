// Sending the side fixes outside an update: from the Firmware page, the banner and the sheet.

import { SideStatus } from "@/services/side";
import type { SideHost } from "@/services/side-host";
import { explainSideStatus, type SideWrite } from "@/services/side-decision";
import type { Clock } from "@/services/updater/transport";

export interface SideActionHost {
    sides?: SideHost;
    clock: Clock;
    /** Wait for the keyboard to come back after the half with USB restarts. */
    waitForDevice(timeoutMs: number): Promise<unknown>;
}

/**
 * Send the SETs in order (the other half first), waiting for each half to restart.
 * Returns null when every write took, or why one didn't, in plain words.
 */
export async function applySideWrites(host: SideActionHost, writes: SideWrite[]): Promise<string | null> {
    const sides = host.sides;
    if (!sides) return "This keyboard can't set its sides from Keybard.";
    const strap = (await sides.read())?.strap;
    for (const w of writes) {
        let status: number;
        try {
            status = await sides.write(w.role, w.side);
        } catch {
            return "The keyboard stopped answering. Reconnect it, then try again.";
        }
        if (status !== SideStatus.OK && status !== SideStatus.OTHER_ACCEPTED) {
            return explainSideStatus(status, { role: w.role, wanted: w.side, strap: w.role === "usb" ? strap : undefined });
        }
        if (w.role === "usb") {
            await host.waitForDevice(30_000);
        } else {
            const deadline = host.clock.now() + 10_000;
            await host.clock.sleep(500);
            while (host.clock.now() < deadline) {
                const r = await sides.read();
                if (r?.otherConnected && r.otherReported && r.otherSide === w.side) break;
                await host.clock.sleep(500);
            }
        }
    }
    return null;
}
