import { appStorage } from "@/utils/app-storage";
import compiledLayers from "virtual:bundled-layers";
/**
 * Layer Library Service
 * Manages local layer database - reading from bundled JSON and writing to localStorage
 * Also handles importing .svil layout files for the Layouts panel
 */

import type {
    LayerDatabase,
    LayerEntry,
    LayerSearchOptions,
    LayerSearchResults,
    LayoutGroup,
    ImportedLayer,
    ImportedLayoutsStorage,
    StoredLayerEntry,
    StoredLayoutGroup,
} from '../types/layer-library';
import type { KeyboardInfo } from '../types/keyboard.types';
import { fileService } from './file.service';
import { keymapFromStored, keymapToNames, type StoredKeymap } from '@/utils/stored-keymap';

// localStorage key for user-added layers
const STORAGE_KEY = 'keybard-layer-library';

// localStorage key for imported layouts
const IMPORTED_LAYOUTS_KEY = 'keybard-imported-layouts';

// Keycodes for empty layer detection
const KC_NO = 0;
const KC_TRNS = 1;

// Path to bundled layers
const BUNDLED_LAYERS_PATH = `${import.meta.env.BASE_URL}layer-library/layers.json`;

// Library files store keycodes by name from version 2 on.
const LAYER_DATABASE_VERSION = 2;

/**
 * Saved keymaps hold keycode names. Saves from before that hold numbers, which
 * were written with this same keycode table, so naming them now is exact.
 */
function namedKeymap(keymap: StoredKeymap): string[] {
    return keymap.map(key => typeof key === 'number' ? keymapToNames([key])[0] : key);
}

function namesChanged(keymap: StoredKeymap): boolean {
    return keymap.some(key => typeof key === 'number');
}

/**
 * Resolve a saved keymap to keycodes, or null if a name is unknown right now.
 * Board-specific names (custom keycodes) only resolve once that board is
 * connected, so an unresolved entry is kept in storage and skipped for now.
 */
function resolvedKeymap(keymap: StoredKeymap, label: string): number[] | null {
    try {
        return keymapFromStored(keymap);
    } catch (e) {
        console.warn(`Layer "${label}" not shown: ${(e as Error).message}`);
        return null;
    }
}

export class LayerLibraryService {
    // Kept as saved (keycode names) and resolved to keycodes when read, so a
    // name that resolves only once its board is connected is never lost.
    private bundledLayers: StoredLayerEntry[] = [];
    private userLayers: StoredLayerEntry[] = [];
    private isLoaded = false;

    /**
     * Load layers from bundled JSON and localStorage
     */
    async loadLayers(): Promise<LayerEntry[]> {
        if (!this.isLoaded) {
            await this.fetchBundledLayers();
            this.loadUserLayers();
            this.isLoaded = true;
        }
        return this.getAllLayers();
    }

    /**
     * Fetch bundled layers from public JSON file
     */
    private async fetchBundledLayers(): Promise<void> {
        try {
            // Keybard Paranoid compiles the library in; it never fetches.
            if (compiledLayers) {
                this.bundledLayers = (compiledLayers as LayerDatabase).layers || [];
                return;
            }
            const response = await fetch(BUNDLED_LAYERS_PATH);
            if (response.ok) {
                const data = await response.json() as LayerDatabase;
                this.bundledLayers = data.layers || [];
            }
        } catch (e) {
            console.warn('Failed to load bundled layers:', e);
            this.bundledLayers = [];
        }
    }

    /**
     * Load user-added layers from localStorage
     */
    private loadUserLayers(): void {
        try {
            const stored = appStorage.getItem(STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored) as StoredLayerEntry[];
                this.userLayers = Array.isArray(data) ? data.filter(layer => Array.isArray(layer?.keymap)) : [];
                if (this.userLayers.some(layer => namesChanged(layer.keymap))) {
                    this.userLayers = this.userLayers.map(layer => ({ ...layer, keymap: namedKeymap(layer.keymap) }));
                    this.saveUserLayers();
                }
            }
        } catch (e) {
            console.warn('Failed to load user layers:', e);
            this.userLayers = [];
        }
    }

    /**
     * Save user layers to localStorage
     */
    private saveUserLayers(): void {
        try {
            appStorage.setItem(STORAGE_KEY, JSON.stringify(this.userLayers));
        } catch (e) {
            console.error('Failed to save user layers:', e);
        }
    }

    /**
     * Get all layers (bundled + user)
     */
    getAllLayers(): LayerEntry[] {
        // User layers first (most recent), then bundled
        const layers: LayerEntry[] = [];
        for (const layer of [...this.userLayers, ...this.bundledLayers]) {
            const keymap = resolvedKeymap(layer.keymap, layer.name);
            if (keymap) layers.push({ ...layer, keymap });
        }
        return layers;
    }

    /**
     * Search and filter layers
     */
    async searchLayers(options: LayerSearchOptions = {}): Promise<LayerSearchResults> {
        await this.loadLayers();

        const { query, tags, keyboardType, sortBy = 'recent' } = options;

        let filtered = this.getAllLayers();

        // Text search (name, description, author)
        if (query) {
            const lowerQuery = query.toLowerCase();
            filtered = filtered.filter(layer =>
                layer.name.toLowerCase().includes(lowerQuery) ||
                layer.description.toLowerCase().includes(lowerQuery) ||
                layer.author.toLowerCase().includes(lowerQuery)
            );
        }

        // Tag filter (match any)
        if (tags && tags.length > 0) {
            filtered = filtered.filter(layer =>
                tags.some(tag => layer.tags.includes(tag))
            );
        }

        // Keyboard type filter
        if (keyboardType) {
            filtered = filtered.filter(layer =>
                layer.keyboardType === keyboardType
            );
        }

        // Sort
        switch (sortBy) {
            case 'recent':
                filtered.sort((a, b) =>
                    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
                );
                break;
            case 'name':
                filtered.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'author':
                filtered.sort((a, b) => a.author.localeCompare(b.author));
                break;
        }

        return {
            layers: filtered,
            total: filtered.length,
        };
    }

    /**
     * Add a new layer (saves to localStorage)
     */
    async addLayer(layer: LayerEntry): Promise<void> {
        await this.loadLayers();

        // Add to beginning of user layers
        this.userLayers.unshift({ ...layer, keymap: keymapToNames(layer.keymap) });
        this.saveUserLayers();
    }

    /**
     * Get a layer by ID
     */
    async getLayerById(id: string): Promise<LayerEntry | null> {
        await this.loadLayers();
        return this.getAllLayers().find(l => l.id === id) || null;
    }

    /**
     * Delete a user layer by ID
     */
    async deleteLayer(id: string): Promise<boolean> {
        await this.loadLayers();

        const index = this.userLayers.findIndex(l => l.id === id);
        if (index >= 0) {
            this.userLayers.splice(index, 1);
            this.saveUserLayers();
            return true;
        }
        return false;
    }

    /**
     * Get all unique tags from all layers
     */
    async getAllTags(): Promise<string[]> {
        await this.loadLayers();

        const tagSet = new Set<string>();
        this.getAllLayers().forEach(layer => {
            layer.tags.forEach(tag => tagSet.add(tag));
        });
        return Array.from(tagSet).sort();
    }

    /**
     * Generate a unique 6-character ID
     */
    generateId(): string {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let id = '';
        for (let i = 0; i < 6; i++) {
            id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return id;
    }

    /**
     * Export all layers (bundled + user) as JSON string
     */
    async exportAllLayers(): Promise<string> {
        await this.loadLayers();
        const database: LayerDatabase = {
            version: LAYER_DATABASE_VERSION,
            layers: [...this.userLayers, ...this.bundledLayers].map(layer => ({ ...layer, keymap: namedKeymap(layer.keymap) })),
        };
        return JSON.stringify(database, null, 2);
    }

    /**
     * Export user layers only as JSON string
     */
    exportUserLayers(): string {
        const database: LayerDatabase = {
            version: LAYER_DATABASE_VERSION,
            layers: this.userLayers.map(layer => ({ ...layer, keymap: namedKeymap(layer.keymap) })),
        };
        return JSON.stringify(database, null, 2);
    }

    /**
     * Clear cache and force reload
     */
    clearCache(): void {
        this.isLoaded = false;
        this.bundledLayers = [];
        // Don't clear userLayers - they're in localStorage
        this.loadUserLayers();
    }

    // --- Layout Import Methods (for .svil files) ---

    /**
     * Check if a layer is empty (only contains KC_NO or KC_TRNS)
     */
    isLayerEmpty(keymap: number[]): boolean {
        return keymap.every(k => k === KC_NO || k === KC_TRNS);
    }

    /**
     * Import a .svil or .vil file and add it to localStorage
     */
    async importLayoutFromFile(file: File): Promise<LayoutGroup> {
        const kbinfo = await fileService.loadFile(file);
        const name = file.name.replace(/\.(svil|viable|vil|json)$/i, '');
        return this.importLayoutFromKeyboardInfo(kbinfo, name);
    }

    /**
     * Convert KeyboardInfo to LayoutGroup
     */
    importLayoutFromKeyboardInfo(kbinfo: KeyboardInfo, name: string): LayoutGroup {
        const layers: ImportedLayer[] = [];

        if (kbinfo.keymap) {
            for (let i = 0; i < kbinfo.keymap.length; i++) {
                const keymap = kbinfo.keymap[i];

                // Skip empty layers
                if (this.isLayerEmpty(keymap)) continue;

                layers.push({
                    index: i,
                    name: kbinfo.cosmetic?.layer?.[i] || `Layer ${i}`,
                    keymap,
                    color: kbinfo.cosmetic?.layer_colors?.[i],
                    ledColor: kbinfo.layer_colors?.[i],
                });
            }
        }

        const layoutGroup: LayoutGroup = {
            id: this.generateId(),
            name,
            source: "imported",
            importedAt: new Date().toISOString(),
            layers,
        };

        // Save to localStorage
        this.saveImportedLayout(layoutGroup);

        return layoutGroup;
    }

    /**
     * Get all imported layouts from localStorage
     */
    getImportedLayouts(): LayoutGroup[] {
        return this.readImportedLayouts().map(layout => ({
            ...layout,
            layers: layout.layers.flatMap(layer => {
                const keymap = resolvedKeymap(layer.keymap, `${layout.name}: ${layer.name}`);
                return keymap ? [{ ...layer, keymap }] : [];
            }),
        }));
    }

    /** Imported layouts as saved, with keycode names */
    private readImportedLayouts(): StoredLayoutGroup[] {
        try {
            const stored = appStorage.getItem(IMPORTED_LAYOUTS_KEY);
            if (stored) {
                const data = JSON.parse(stored) as ImportedLayoutsStorage;
                const layouts = data.layouts || [];
                if (layouts.some(layout => layout.layers.some(layer => namesChanged(layer.keymap)))) {
                    this.saveImportedLayouts(layouts);
                }
                return layouts.map(layout => ({
                    ...layout,
                    layers: layout.layers.map(layer => ({ ...layer, keymap: namedKeymap(layer.keymap) })),
                }));
            }
        } catch (e) {
            console.warn('Failed to load imported layouts:', e);
        }
        return [];
    }

    /**
     * Save an imported layout to localStorage
     */
    private saveImportedLayout(layout: LayoutGroup): void {
        const layouts = this.readImportedLayouts();
        layouts.unshift(layout);
        this.saveImportedLayouts(layouts);
    }

    /**
     * Save all imported layouts to localStorage
     */
    private saveImportedLayouts(layouts: (LayoutGroup | StoredLayoutGroup)[]): void {
        try {
            const storage: ImportedLayoutsStorage = {
                layouts: layouts.map(layout => ({
                    ...layout,
                    layers: layout.layers.map(layer => ({ ...layer, keymap: namedKeymap(layer.keymap) })),
                })),
            };
            appStorage.setItem(IMPORTED_LAYOUTS_KEY, JSON.stringify(storage));
        } catch (e) {
            console.error('Failed to save imported layouts:', e);
        }
    }

    /**
     * Delete an imported layout by ID
     */
    deleteImportedLayout(id: string): boolean {
        const layouts = this.readImportedLayouts();
        const index = layouts.findIndex(l => l.id === id);
        if (index >= 0) {
            layouts.splice(index, 1);
            this.saveImportedLayouts(layouts);
            return true;
        }
        return false;
    }

    /**
     * Delete a single layer from an imported layout.
     * If the layout becomes empty, delete the layout as well.
     */
    deleteImportedLayer(layoutId: string, layerIndex: number): boolean {
        const layouts = this.readImportedLayouts();
        const layout = layouts.find(l => l.id === layoutId);
        if (!layout) return false;

        const previousLength = layout.layers.length;
        layout.layers = layout.layers.filter(layer => layer.index !== layerIndex);
        if (layout.layers.length === previousLength) return false;

        if (layout.layers.length === 0) {
            const index = layouts.findIndex(l => l.id === layoutId);
            if (index >= 0) {
                layouts.splice(index, 1);
            }
        }

        this.saveImportedLayouts(layouts);
        return true;
    }

    /**
     * Get the current keyboard as a LayoutGroup
     */
    getCurrentKeyboardGroup(keyboard: KeyboardInfo): LayoutGroup {
        const layers: ImportedLayer[] = [];

        if (keyboard.keymap) {
            for (let i = 0; i < keyboard.keymap.length; i++) {
                const keymap = keyboard.keymap[i];

                // Skip empty layers
                if (this.isLayerEmpty(keymap)) continue;

                layers.push({
                    index: i,
                    name: keyboard.cosmetic?.layer?.[i] || `Layer ${i}`,
                    keymap,
                    color: keyboard.cosmetic?.layer_colors?.[i],
                    ledColor: keyboard.layer_colors?.[i],
                });
            }
        }

        return {
            id: "current",
            name: keyboard.cosmetic?.name || keyboard.name || "Current Keyboard",
            source: "current",
            layers,
        };
    }

    /**
     * Convert an ImportedLayer to a LayerEntry (for clipboard/paste compatibility)
     */
    importedLayerToLayerEntry(layer: ImportedLayer, sourceLayout: string): LayerEntry {
        return {
            id: this.generateId(),
            name: layer.name,
            description: `Imported from ${sourceLayout}`,
            author: "Imported",
            tags: [],
            keyboardType: "svalboard",
            keyCount: layer.keymap.length,
            keymap: layer.keymap,
            layerColor: layer.color,
            ledColor: layer.ledColor,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            sourceLayout,
        };
    }
}

// Export singleton instance
export const layerLibraryService = new LayerLibraryService();
