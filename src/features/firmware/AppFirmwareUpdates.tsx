// The editor's firmware updates. On dev servers and the test site, `?fwfake=1` backs them
// with the mock board (the harness's), so Settings > Firmware can be tried and reviewed
// without a keyboard (`&sides=<scenario>` for the one-image screens). The mock is a dynamic
// import behind the build constant __FW_FAKE__: production, next and Paranoid builds drop it.

import { lazy, Suspense, type ReactNode } from "react";

import { FirmwareUpdateProvider } from "./FirmwareUpdateProvider";

const FW_FAKE = typeof __FW_FAKE__ !== "undefined" && __FW_FAKE__;
const DevFakeFirmware = FW_FAKE ? lazy(() => import("./harness/DevFakeFirmware")) : null;

function wantsFake(): boolean {
    if (!FW_FAKE || typeof location === "undefined") return false;
    return new URLSearchParams(location.search).has("fwfake");
}

export function AppFirmwareUpdates({ children }: { children: ReactNode }) {
    if (DevFakeFirmware && wantsFake()) {
        return (
            <Suspense fallback={children}>
                <DevFakeFirmware>{children}</DevFakeFirmware>
            </Suspense>
        );
    }
    return <FirmwareUpdateProvider>{children}</FirmwareUpdateProvider>;
}
