import type { CSSProperties } from 'react';

// The Overlay preview's desktop stand-in backgrounds (docs/practice/spec.md N-16). They imitate the
// user's desktop behind the overlay, not Keybard chrome, so they are data and stay the same in both
// themes. Moved here from trainer.css `.trainer-bg-*`.

export type PreviewBackground = 'Light' | 'Dark' | 'Busy';

export interface PreviewBackgroundStyle {
    /** The canvas paint. */
    style: CSSProperties;
    /**
     * The 1 px halo outside the page-drawn selection ring (§5.14 "Two-tone selection ring"). The ring
     * follows Keybard's theme but the canvas follows this choice, so the halo carries the 3:1.
     */
    halo: string;
    /** Text and dashed border of the empty well drawn on this background (§5.16 no board selected). */
    muted: string;
}

export const PREVIEW_BACKGROUNDS: Record<PreviewBackground, PreviewBackgroundStyle> = {
    Light: { style: { background: '#f5f5f1' }, halo: '#111214', muted: '#3a4440' },
    Dark: {
        style: { backgroundColor: '#273436', backgroundImage: 'radial-gradient(#496060 0.7px, transparent .7px)', backgroundSize: '16px 16px' },
        halo: '#ffffff',
        muted: '#c9d2d4',
    },
    Busy: {
        style: { background: 'repeating-linear-gradient(125deg, #c8d1c8 0 30px, #8a9c92 30px 31px, #e6e8dc 31px 61px)' },
        halo: '#111214',
        muted: '#3a4440',
    },
};

export const PREVIEW_BACKGROUND_NAMES = Object.keys(PREVIEW_BACKGROUNDS) as PreviewBackground[];
