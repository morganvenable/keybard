import type { CustomUIMenuItem } from '../../src/types/vial.types';

/**
 * Mirrors the "Pointing Device" VIA3 menu from sval-qmk (formerly viable-qmk)
 * keyboards/svalboard/keymaps/viable/viable.json. The PointingPanel renders this
 * tree dynamically, so new firmware settings (like the per-pointer auto-mouse
 * activation toggles) show up without UI code changes.
 * Keep this in sync when the firmware definition changes.
 */
const DPI_OPTIONS = ['200', '400', '600', '800', '1200', '1600', '2400', '3200', '4800', '6400', '12000'];

export const SVALBOARD_AUTO_MOUSE_MENU: CustomUIMenuItem[] = [
    {
        label: 'Auto Mouse',
        content: [
            { label: 'Enable Auto Mouse', type: 'toggle', content: ['id_automouse_enable', 0, 4] },
            {
                showIf: '{id_automouse_enable} == 1',
                content: [
                    {
                        label: 'Layer Timeout',
                        type: 'dropdown',
                        options: ['200 ms', '300 ms', '400 ms', '500 ms', '800 ms', 'Infinite'],
                        content: ['id_automouse_timeout', 0, 5],
                    },
                    { label: 'Activation Threshold', type: 'range', options: [0, 1000], content: ['id_automouse_threshold', 0, 6] },
                    { label: 'Activation Decay (x10ms)', type: 'range', options: [0, 255], content: ['id_automouse_decay', 0, 10] },
                    { label: 'Left Pointer Activates', type: 'toggle', content: ['id_left_automouse', 0, 11] },
                    { label: 'Right Pointer Activates', type: 'toggle', content: ['id_right_automouse', 0, 12] },
                ],
            },
        ],
    },
];

export const SVALBOARD_POINTING_MENU: CustomUIMenuItem[] = [
    {
        label: 'Pointing Device',
        content: [
            {
                label: 'Left Pointer',
                content: [
                    { label: 'DPI', type: 'dropdown', options: DPI_OPTIONS, content: ['id_left_dpi', 0, 0] },
                    { label: 'Scroll Mode', type: 'toggle', content: ['id_left_scroll', 0, 1] },
                ],
            },
            {
                label: 'Right Pointer',
                content: [
                    { label: 'DPI', type: 'dropdown', options: DPI_OPTIONS, content: ['id_right_dpi', 0, 2] },
                    { label: 'Scroll Mode', type: 'toggle', content: ['id_right_scroll', 0, 3] },
                ],
            },
            ...SVALBOARD_AUTO_MOUSE_MENU,
            {
                label: 'Scroll Settings',
                content: [
                    { label: 'Natural Scroll', type: 'toggle', content: ['id_natural_scroll', 0, 7] },
                    { label: 'Axis Lock', type: 'toggle', content: ['id_axis_lock', 0, 8] },
                ],
            },
            {
                label: 'Advanced',
                content: [
                    { label: 'Scan Speed', type: 'dropdown', options: ['0', '1', '2', '3', '4', '5', '6'], content: ['id_turbo_scan', 0, 9] },
                ],
            },
        ],
    },
];
