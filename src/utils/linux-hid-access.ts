/**
 * Linux keeps /dev/hidraw* root-only unless a udev rule grants access. Chrome's
 * WebHID permission is only the site grant, so a device the chooser offered can
 * still fail to open with NotAllowedError. Older Svalboard setups matched the
 * Vial serial number, which current firmware no longer reports, so this is the
 * usual failure after a firmware update on Linux.
 */

const hex4 = (id: number) => id.toString(16).padStart(4, "0");

export function isLinuxUserAgent(userAgent: string = navigator.userAgent): boolean {
    return /Linux/.test(userAgent) && !/Android/.test(userAgent);
}

/** Shell commands that install a udev rule for this vendor/product and apply it. */
export function udevRuleCommand(vendorId: number, productId: number): string {
    const rule = `KERNEL=="hidraw*", SUBSYSTEM=="hidraw", ATTRS{idVendor}=="${hex4(vendorId)}", ATTRS{idProduct}=="${hex4(productId)}", MODE="0660", TAG+="uaccess"`;
    return [
        `echo '${rule}' \\`,
        `  | sudo tee /etc/udev/rules.d/60-svalboard.rules`,
        `sudo udevadm control --reload && sudo udevadm trigger --subsystem-match=hidraw`,
    ].join("\n");
}

export class LinuxHidAccessError extends Error {
    readonly udevCommand: string;

    constructor(vendorId: number, productId: number, cause?: unknown) {
        super("Linux blocked access to the keyboard. Add a udev rule for it, then unplug and replug the board and connect again.");
        this.name = "LinuxHidAccessError";
        this.udevCommand = udevRuleCommand(vendorId, productId);
        if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
    }
}

/** Translate a failed HIDDevice.open() into LinuxHidAccessError when it is the udev case. */
export function toHidOpenError(error: unknown, device: HIDDevice, userAgent?: string): unknown {
    const name = (error as { name?: unknown } | null)?.name;
    if (name === "NotAllowedError" && isLinuxUserAgent(userAgent)) {
        return new LinuxHidAccessError(device.vendorId, device.productId, error);
    }
    return error;
}
