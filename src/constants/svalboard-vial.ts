// Svalboard's Vial firmware, svalboard/vial-qmk v2025-11-01 (keymap "vial"), as
// its .vil files describe it. Moving from Vial to Svalboard QMK goes through these
// files: they store keycodes by name, so they carry across firmwares safely.

/** VIAL_KEYBOARD_UID, little-endian; Svalboard QMK reports the same UID. */
export const SVALBOARD_VIAL_UID = 5199957870438586395n;

/**
 * Vial names the board's custom keycodes by position (USER00, USER01...); these
 * are the keycodes at those positions, from keyboards/svalboard/keymaps/vial/vial.json.
 */
export const SVALBOARD_VIAL_CUSTOM_KEYCODES = [
    { name: 'SV_LEFT_DPI_INC', title: "Increase the DPI of the left pointing device.", shortName: "Left\nDPI +" },
    { name: 'SV_LEFT_DPI_DEC', title: "Decrease the DPI of the left pointing device.", shortName: "Left\nDPI -" },
    { name: 'SV_RIGHT_DPI_INC', title: "Increase the DPI of the right pointing device.", shortName: "Right\nDPI +" },
    { name: 'SV_RIGHT_DPI_DEC', title: "Decrease the DPI of the right pointing device.", shortName: "Right\nDPI -" },
    { name: 'SV_LEFT_SCROLL_TOGGLE', title: "Toggle if the left pointer is scroll or pointer.", shortName: "Scroll\nLeft\nToggle" },
    { name: 'SV_RIGHT_SCROLL_TOGGLE', title: "Toggle if the right pointer is scroll or pointer.", shortName: "Scroll\nRight\nToggle" },
    { name: 'SV_RECALIBRATE_POINTER', title: "Reset the calibration of the pointing device", shortName: "Fix\nDrift" },
    { name: 'SV_MH_CHANGE_TIMEOUTS', title: "Cycle between various settings of the mouse keys timer.", shortName: "Mouse\nKey\nTimer" },
    { name: 'SV_CAPS_WORD', title: "Toggle Caps Word.", shortName: "Caps\nWord\nToggle" },
    { name: 'SV_AXIS_SCROLL_LOCK', title: "Toggle Axis Scroll Lock.", shortName: "Axis\nScroll\nLock" },
    { name: 'SV_TOGGLE_23_67', title: "Toggle layer 2 and 3, if 4 and 5 also active toggle 6 and 7", shortName: "MO 23\n(45=67)" },
    { name: 'SV_TOGGLE_45_67', title: "Toggle layer 4 and 5, if 2 and 3 also active toggle 6 and 7", shortName: "MO 45\n(23=67)" },
    { name: 'SV_SNIPER_2', title: "Slow the cursor 2x more.", shortName: "Sniper\n2x" },
    { name: 'SV_SNIPER_3', title: "Slow the cursor 3x more.", shortName: "Sniper\n3x" },
    { name: 'SV_SNIPER_5', title: "Slow the cursor 5x more.", shortName: "Sniper\n5x" },
    { name: 'SV_SCROLL_HOLD', title: "Hold to toggle the scrolling mode of both pointers.", shortName: "Scroll\nToggle\nHold" },
    { name: 'SV_SCROLL_TOGGLE', title: "Press to toggle the scrolling mode of both pointers.", shortName: "Scroll\nToggle" },
    { name: 'SV_OUTPUT_STATUS', title: "Output the current internal state of the keyboard.", shortName: "Output\nStatus" },
    { name: 'SV_TOGGLE_AUTOMOUSE', title: "Toggle Auto Mouse layer activation.", shortName: "AutoMouse\nToggle" },
    { name: 'SV_TURBO_SCAN', title: "Change the scan mode of the keyboard.", shortName: "Turbo\nScan" },
];
