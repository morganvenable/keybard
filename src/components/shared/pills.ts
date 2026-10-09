// Pill buttons (docs/practice/spec.md §5.0 "Start, Resume, Use text"), shared by Practice and Overlay.
//
// - brand: the single forward action on a screen (Download for Windows, Start). Brand green as it is
//   today (OD6), from ConnectKeyboard's Connect Keyboard pill.
// - ink: commit actions (Reveal, Remembered), the LayerSelector ink pill.
// - quiet: secondary actions beside a brand pill (Connect to Keybard Host, Try again).

export const PILL = "inline-flex items-center justify-center gap-2 text-sm font-medium cursor-pointer transition-all px-5 py-1.5 rounded-full whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 [&_svg]:size-4 [&_svg]:shrink-0";
export const PILL_BRAND = `${PILL} bg-kb-primary text-white hover:bg-kb-primary/90`;
export const PILL_INK = `${PILL} bg-kb-active text-kb-active-fg hover:bg-kb-active/80`;
export const PILL_QUIET = `${PILL} bg-kb-gray text-kb-ink border border-kb-gray-border hover:bg-kb-gray-medium`;
