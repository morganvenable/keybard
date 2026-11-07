// Installing one test build over another with the same fw_version (x4.5-balltest -> x4.5-balldiag -> x4.5-ballfix).
import { describe, expect, it } from "vitest";
import { UpdaterClient } from "@/services/updater/client";
import { planInstall } from "@/services/updater/checks";
import { fakeSetup, fixtureOneImage, type FixtureRelease } from "@/services/updater/fake-host";
import { memoryFlowStore, UpdateFlow } from "@/services/updater/flow";
import { VirtualClock } from "@/services/updater/transport";
import type { FirmwareReleasePin } from "@/constants/firmware-releases";

const pin = (r: FixtureRelease): FirmwareReleasePin => ({
    tag: r.tag, kind: "x", fwVersion: r.fwVersion, updaterProtocol: 4,
    file: { uf2: `svalboard_sval_${r.tag}.uf2`, sha256: r.files[0].sha256, size: r.files[0].bytes.length },
    notesUrl: "",
});

async function crossgrade(from: [string, number], to: [string, number]) {
    const clock = new VirtualClock();
    const running = await fixtureOneImage(from[0], from[1]);
    const release = await fixtureOneImage(to[0], to[1]);
    const { board, host } = fakeSetup({ clock, running });
    const plan = await planInstall(new UpdaterClient(board), { kind: "release", release: pin(release), files: release.files }, { clock, releases: [pin(release), pin(running)] });
    if ("id" in plan) return { plan, state: null };
    const flow = UpdateFlow.create(host, memoryFlowStore(), { plan, afterwards: "restore", backup: { fileName: "k.svil", svil: "{}" } });
    return { plan, state: await flow.run() };
}

describe("crossgrade", () => {
    for (const [from, to] of [
        [["x4.5-balltest", 21], ["x4.5-balldiag", 21]],
        [["x4.5-balldiag", 21], ["x4.5-balltest", 21]],
        [["x4.5", 20], ["x4.5-balldiag", 21]],
        [["x4.5-balldiag", 21], ["x4.5", 20]],
        [["x4.5-balltest", 21], ["x4.5-ballfix", 22]],
        [["x4.5-ballfix", 22], ["x4.5", 20]],
    ] as [string, number][][]) {
        it(`${from[0]} -> ${to[0]}`, async () => {
            const { plan, state } = await crossgrade(from as [string, number], to as [string, number]);
            console.log(from[0], "->", to[0], "id" in plan ? `plan failed ${plan.id}` : `${plan.kind ?? ""} refusal=${JSON.stringify((plan as any).refusal ?? null)}`, state ? `step=${state.step}` : "");
            expect("id" in plan).toBe(false);
            expect(state?.step).toBe("done");
        });
    }
});
