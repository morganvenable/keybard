import { FirmwareLink } from '@/components/FirmwareUpdate';
import { isKnownKeycodeVersion } from '@/constants/keycode-numbering';
import type { KeyboardInfo } from '@/types/keyboard.types';
import type { UnsupportedFirmwareInfo } from '@/utils/unsupported-firmware';

interface Props {
    keyboard: KeyboardInfo | null;
    isConnected: boolean;
    failure?: UnsupportedFirmwareInfo | null;
    error?: string | null;
}

/** Capability checks apply only to a live board, never an imported keymap. */
export default function FirmwareStatus({ keyboard, isConnected, failure, error }: Props) {
    let message: string | undefined;
    let update = false;
    if (failure) {
        switch (failure.kind) {
            case 'svalboard-vial':
                message = `This Svalboard uses older Vial firmware${failure.reportedVersion ? ` (${failure.reportedVersion})` : ''}. Update to Svalboard QMK for live keyboard rendering. Save your layout in Vial first; restore it with Keybard after updating.`;
                update = true;
                break;
            case 'outdated-sval':
                message = `Sval protocol ${failure.svilProto ?? '?'} is too old for practice. Update your board, then reconnect.`;
                update = true;
                break;
            case 'no-response':
                message = 'The board did not respond. Close other keyboard apps or tabs, unplug and reconnect the board, then try again.';
                break;
            case 'other-qmk':
                message = 'practice needs a Svalboard running Svalboard QMK firmware.';
                break;
            default:
                message = 'Could not identify the firmware. Reconnect your Svalboard and try again. If it still fails, check its firmware in Keybard.';
        }
    } else if (error) {
        message = error;
    } else if (isConnected && keyboard) {
        if (keyboard.keycode_version && !isKnownKeycodeVersion(keyboard.keycode_version)) {
            message = `This board uses keycode numbering ${keyboard.keycode_version}, which practice does not recognize. Key labels and hints may be incorrect. Update practice to support this firmware.`;
        } else if (((keyboard.feature_flags ?? 0) & 0x60) !== 0x60) {
            // GET_INFO: context layer (0x20) and default layer state (0x40).
            message = 'This firmware does not report all layer information. On-screen keys and hints may be incorrect when switching layers. Update your Svalboard firmware, then reconnect.';
            update = true;
        }
    }
    if (!message) return null;
    return <div role="alert" className="practice-error"><p>{message}{update && <> Get <FirmwareLink />.</>}</p></div>;
}
