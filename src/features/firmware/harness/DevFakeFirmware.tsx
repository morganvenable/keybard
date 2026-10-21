// Development only (?fwfake=1): Settings > Firmware against the mock board, as the harness
// runs it. &running=v3|x4|v2  &nochord=1  &fault=...  &speed=4  &differ=1  &sides=<scenario>
// Review links land on the state with no clicks: Settings > Firmware opens by itself, and
// &fwrun=1 starts the newest release's update (the sheet, then Start once it's ready).

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import type { FirmwareReleasePin } from "@/constants/firmware-releases";
import type { Fault } from "@/services/updater/fake-board";
import { FakeHost, fakeSetup, fixtureOneImage, fixtureRelease, type FixtureRelease } from "@/services/updater/fake-host";
import { sidesScenario } from "@/services/updater/fake-sides-scenarios";
import { HAND_LEFT, HAND_RIGHT, type Hand } from "@/services/updater/protocol";
import { readBoardSummary, type BoardSummary } from "../board-summary";
import { FirmwareUpdateProvider, useFirmwareUpdates } from "../FirmwareUpdateProvider";
import { OPEN_FIRMWARE_EVENT } from "../useHalvesDiffer";

/** Open Settings > Firmware, and with &fwrun=1 start the update, once the board has been read. */
function ReviewOpener({ run }: { run: boolean }) {
    const updates = useFirmwareUpdates();
    const done = useRef(false);
    useEffect(() => {
        if (done.current || !updates?.board) return;
        done.current = true;
        const t = setTimeout(() => {
            window.dispatchEvent(new CustomEvent(OPEN_FIRMWARE_EVENT));
            if (run && updates.releases[0]) updates.install({ kind: "release", release: updates.releases[0] });
        }, 300);
        return () => clearTimeout(t);
    }, [updates, run]);
    return null;
}
import type { FirmwareUiHost, UpdateBackup } from "../useFirmwareUpdate";
import { pinOf, ScaledClock } from "./HarnessApp";

class DevFakeHost extends FakeHost implements FirmwareUiHost {
    async makeBackup({ fromTag }: { fromTag: string }): Promise<UpdateBackup> {
        await this.clock.sleep(400);
        return { fileName: `Kip-${fromTag}-2026-10-15.svil`, svil: "{}" };
    }
    async prepareRows() { return []; }
    boardName() { return "Kip"; }
    chordLegends(hand: Hand): [string, string] { return hand === HAND_RIGHT ? ["M", ","] : ["V", "C"]; }
}

interface Ready {
    host: DevFakeHost;
    releases: FirmwareReleasePin[];
    byTag: Record<string, FixtureRelease>;
}

export default function DevFakeFirmware({ children }: { children: ReactNode }) {
    const [ready, setReady] = useState<Ready | null>(null);
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        void (async () => {
            const size = 0x1e000;
            const v2 = await fixtureRelease("v2", 2000, { imageLen: size });
            const v3 = await fixtureRelease("v3", 3000, { imageLen: size });
            const sides = sidesScenario(params.get("sides"));
            const x4 = sides ? await fixtureOneImage("x4", 4000, { imageLen: size }) : await fixtureRelease("x4", 4000, { imageLen: size, noChord: params.has("nochord") });
            const running = params.get("running") === "x4" ? x4 : params.get("running") === "v2" ? v2 : v3;
            const clock = new ScaledClock(Number(params.get("speed") ?? 4));
            const f = params.get("fault");
            const faults: Fault[] = !f ? [] : f.startsWith("unplug-") ? [{ kind: "unplug", at: f.slice(7) as "other-send" }] : [{ kind: f } as Fault];
            const { board, sides: fakeSides } = fakeSetup({ sides,
                clock, running, noChord: params.has("nochord"), faults, usbHand: params.get("usb") === "left" ? HAND_LEFT : HAND_RIGHT,
                chordAfterMs: 3000, otherRunning: params.has("differ") ? { tag: v2.tag, fwVersion: v2.fwVersion } : undefined,
            });
            const host = new DevFakeHost(board, clock);
            host.sides = fakeSides?.host;
            const releases = [pinOf(x4, ["One hold approves both halves", "Settings come back after every install", "Faster trackball start"]), pinOf(v3, ["Layer colors per half"])];
            setReady({ host, releases, byTag: { v2, v3, x4 } });
        })();
    }, []);
    const readBoard = useCallback(async (): Promise<BoardSummary | null> => (ready ? readBoardSummary(ready.host.board, null, ready.host.sides) : null), [ready]);
    const files = useCallback(async (pin: FirmwareReleasePin) => ready!.byTag[pin.tag].files, [ready]);
    if (!ready) return <>{children}</>;
    return (
        <FirmwareUpdateProvider host={ready.host} readBoard={readBoard} releases={ready.releases} files={files} autoStart={new URLSearchParams(location.search).has("fwrun")}>
            {children}
            <ReviewOpener run={new URLSearchParams(location.search).has("fwrun")} />
        </FirmwareUpdateProvider>
    );
}
