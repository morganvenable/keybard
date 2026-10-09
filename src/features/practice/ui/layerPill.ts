// Layer pills (docs/practice/spec.md §5.5 Drill layer, §5.8 heatmap layers): LayerSelector's pill classes
// ([kb] LayerSelector.tsx:297), with the layer's color as a dot before the name.

export const LAYER_PILL = "inline-flex items-center gap-1.5 px-4 py-1 rounded-full transition-colors text-sm font-medium cursor-pointer border-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 whitespace-nowrap";
export const LAYER_PILL_ON = "bg-gray-800 text-white dark:bg-neutral-200 dark:text-neutral-900 shadow-md scale-105";
export const LAYER_PILL_OFF = "bg-transparent text-gray-600 dark:text-neutral-300 hover:bg-gray-200 dark:hover:bg-neutral-700";
/** LayerSelector's divider ([kb] LayerSelector.tsx:533). */
export const LAYER_DIVIDER = "h-4 w-[1px] bg-slate-400 dark:bg-neutral-600 flex-shrink-0";
