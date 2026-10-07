// Type definitions for the Layer Library feature
// Stores and browses individual keyboard layers

/**
 * A single layer entry in the library
 */
export interface LayerEntry {
    /** Unique 6-character identifier */
    id: string;

    /** Display name (e.g., "Gaming WASD", "Vim Navigation") */
    name: string;

    /** Description of the layer's purpose */
    description: string;

    /** Author's display name */
    author: string;

    /** Tags for search/filtering (e.g., ["gaming", "vim"]) */
    tags: string[];

    /** Keyboard type identifier (e.g., "svalboard") */
    keyboardType: string;

    /** Number of keys in the keymap */
    keyCount: number;

    /** Flat array of keycodes for this layer */
    keymap: number[];

    /** Optional layer color name (for display) */
    layerColor?: string;

    /** Optional LED color (HSV values for hardware) */
    ledColor?: { hue: number; sat: number; val: number };

    /** ISO date string of creation */
    createdAt: string;

    /** ISO date string of last update */
    updatedAt: string;

    /** Optional source info (where this layer came from) */
    sourceLayout?: string;
}

/**
 * A layer entry as saved (browser storage, library files): the keymap holds
 * keycode names. Version 1 files and older saves hold numbers.
 */
export interface StoredLayerEntry extends Omit<LayerEntry, 'keymap'> {
    keymap: (string | number)[];
}

/**
 * Database file structure
 */
export interface LayerDatabase {
    /** Database version: 2 stores keycodes by name, 1 by number */
    version: number;

    /** Array of layer entries */
    layers: StoredLayerEntry[];
}

/**
 * Clipboard state for layer copy/paste
 */
export interface LayerClipboard {
    /** The copied layer */
    layer: LayerEntry;

    /** Timestamp when copied */
    copiedAt: number;
}

/**
 * Search/filter options for browsing layers
 */
export interface LayerSearchOptions {
    /** Text search in name/description/author */
    query?: string;

    /** Filter by tags (match any) */
    tags?: string[];

    /** Filter by keyboard type */
    keyboardType?: string;

    /** Sort order */
    sortBy?: 'recent' | 'name' | 'author';
}

/**
 * Search results
 */
export interface LayerSearchResults {
    /** Matching layers */
    layers: LayerEntry[];

    /** Total count */
    total: number;
}

/**
 * Data for publishing a new layer
 */
export interface PublishLayerData {
    /** Layer name */
    name: string;

    /** Description */
    description: string;

    /** Author display name */
    author: string;

    /** Tags */
    tags: string[];
}

// --- Layout Library Types (for importing .svil files) ---

/**
 * A group of layers from an imported layout file or the current keyboard
 */
export interface LayoutGroup {
    /** Unique identifier */
    id: string;

    /** Display name (from filename or user-provided) */
    name: string;

    /** Source of the layout */
    source: "current" | "imported";

    /** ISO date string when imported (for imported layouts only) */
    importedAt?: string;

    /** Non-empty layers in this layout */
    layers: ImportedLayer[];
}

/**
 * A single layer from an imported layout
 */
export interface ImportedLayer {
    /** Original layer index (0, 1, 2...) */
    index: number;

    /** Layer name from cosmetic or "Layer N" */
    name: string;

    /** Flat array of keycodes */
    keymap: number[];

    /** Layer display color if available */
    color?: string;

    /** LED color (HSV values for hardware) */
    ledColor?: { hue: number; sat: number; val: number };
}

/**
 * localStorage structure for imported layouts
 */
export interface ImportedLayoutsStorage {
    /** Array of imported layout groups; layer keymaps hold keycode names (numbers in older saves) */
    layouts: StoredLayoutGroup[];
}

/** A layout group as saved: its layers' keymaps hold keycode names. */
export interface StoredLayoutGroup extends Omit<LayoutGroup, 'layers'> {
    layers: (Omit<ImportedLayer, 'keymap'> & { keymap: (string | number)[] })[];
}
