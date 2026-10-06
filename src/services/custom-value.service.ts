// Custom Value Service - VIA3 Custom UI value get/set operations
import { SvilUSB, usbInstance } from "./usb.service";
import type { CustomUIMenuItem, CustomUIValueRef, CustomValueEntry } from "../types/keyboard.types";

/**
 * Service for managing VIA3 custom UI values
 * Handles GET/SET/SAVE operations via VIA protocol commands
 */
export class CustomValueService {
    private usb: SvilUSB;
    private cache: Map<string, number> = new Map();

    constructor(usb: SvilUSB) {
        this.usb = usb;
    }

    /**
     * Parse a content array to extract value reference
     * Content format: ["value_key", channel, value_id, ...extra_indices]
     */
    parseValueRef(content: (string | number)[]): CustomUIValueRef | null {
        if (!Array.isArray(content) || content.length < 3) {
            return null;
        }

        const key = String(content[0]);
        const channel = Number(content[1]);
        const valueId = Number(content[2]);
        const extraIndices = content.slice(3).map(Number);

        return {
            key,
            channel,
            valueId,
            extraIndices: extraIndices.length > 0 ? extraIndices : undefined,
        };
    }

    /**
     * Get a custom value from the keyboard
     * Uses VIA CMD_VIA_CUSTOM_GET_VALUE (0x08)
     * @param width - byte width of value (1 or 2), defaults to 1
     */
    async get(channel: number, valueId: number, width: number = 1): Promise<number> {
        // Use the proper customValueGet method which uses 0x08 and skips header bytes
        const data = await this.usb.customValueGet(channel, valueId, width);

        // DEBUG: Log raw response bytes
        const hexBytes = Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log(`[CustomValue] GET ch=${channel} id=${valueId} w=${width}: [${hexBytes}]`);

        if (!data || data.length < 1) {
            console.warn("Invalid custom value response:", data);
            return 0;
        }

        // Parse value from data bytes, little-endian
        return this.bytesToInt(Array.from(data), width);
    }

    /**
     * Get raw bytes from a custom value on the keyboard
     * Returns the raw byte array without integer conversion
     */
    async getRaw(channel: number, valueId: number, width: number = 1): Promise<number[]> {
        const data = await this.usb.customValueGet(channel, valueId, width);

        if (!data || data.length < 1) {
            console.warn("Invalid custom value response:", data);
            return new Array(width).fill(0);
        }

        return Array.from(data).slice(0, width);
    }

    /**
     * Set a custom value on the keyboard
     * Uses VIA CMD_VIA_CUSTOM_SET_VALUE (0x07)
     * @param width - byte width of value (1 or 2), defaults to 1
     */
    async set(channel: number, valueId: number, value: number, width: number = 1): Promise<void> {
        const valueBytes = this.intToBytes(value, width);

        console.log(`[CustomValue] SET ch=${channel} id=${valueId} value=${value} bytes=[${valueBytes.join(', ')}]`);

        // Use the proper customValueSet method which uses 0x07
        await this.usb.customValueSet(channel, valueId, valueBytes);
    }

    /**
     * Set a custom value on the keyboard from raw bytes
     */
    async setRaw(channel: number, valueId: number, data: number[]): Promise<void> {
        console.log(`[CustomValue] SET_RAW ch=${channel} id=${valueId} bytes=[${data.join(', ')}]`);
        await this.usb.customValueSet(channel, valueId, data);
    }

    /**
     * Save all custom values to EEPROM
     * Uses VIA CMD_VIA_CUSTOM_SAVE (0x09)
     * @param channel - channel to save, defaults to 0 (keyboard-specific)
     */
    async save(channel: number = 0): Promise<void> {
        console.log(`[CustomValue] SAVE channel=${channel}`);
        await this.usb.customValueSave(channel);
    }

    /**
     * Get a value from cache by key
     */
    getCached(key: string): number | undefined {
        return this.cache.get(key);
    }

    /**
     * Set a value in cache
     */
    setCached(key: string, value: number): void {
        this.cache.set(key, value);
    }

    /**
     * Clear the cache
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * Get the entire cache as a Map
     */
    getCache(): Map<string, number> {
        return new Map(this.cache);
    }

    /**
     * Load all values referenced in a menu tree into cache
     * Determines byte width based on control type and options
     */
    async loadMenuValues(menus: CustomUIMenuItem[]): Promise<void> {
        const itemsWithRefs = this.extractAllItemsWithRefs(menus);
        console.log(`[CustomValue] Loading ${itemsWithRefs.length} values from menu`);

        for (const { item, ref } of itemsWithRefs) {
            try {
                const width = this.getByteWidth(item);
                const value = await this.get(ref.channel, ref.valueId, width);
                console.log(`[CustomValue] ${ref.key} (ch=${ref.channel}, id=${ref.valueId}, w=${width}) = ${value}`);
                this.cache.set(ref.key, value);
            } catch (error) {
                console.warn(`Failed to load custom value ${ref.key}:`, error);
            }
        }
    }

    /**
     * Load ALL values from the full menu tree, returning CustomValueEntry[] with raw bytes.
     * Also populates the cache. This is called at connect time.
     */
    async loadAllMenuValues(menus: CustomUIMenuItem[]): Promise<CustomValueEntry[]> {
        const itemsWithRefs = this.extractAllItemsWithRefs(menus);
        console.log(`[CustomValue] Bulk-loading ${itemsWithRefs.length} values from all menus`);

        const entries: CustomValueEntry[] = [];

        for (const { item, ref } of itemsWithRefs) {
            try {
                const width = this.getByteWidth(item);
                const rawBytes = await this.getRaw(ref.channel, ref.valueId, width);
                const intValue = this.bytesToInt(rawBytes, width);

                entries.push({
                    key: ref.key,
                    channel: ref.channel,
                    valueId: ref.valueId,
                    data: rawBytes,
                });

                // Also populate cache with integer value for UI
                this.cache.set(ref.key, intValue);
                console.log(`[CustomValue] ${ref.key} (ch=${ref.channel}, id=${ref.valueId}, w=${width}) = ${intValue} raw=[${rawBytes.join(',')}]`);
            } catch (error) {
                console.warn(`Failed to load custom value ${ref.key}:`, error);
            }
        }

        return entries;
    }

    /**
     * Seed the cache from stored CustomValueEntry[] (no USB needed).
     * Used when loading from file or seeding DynamicMenuPanel from kbinfo.
     */
    populateCacheFromEntries(entries: CustomValueEntry[]): void {
        for (const entry of entries) {
            const intValue = this.bytesToInt(entry.data, entry.data.length);
            this.cache.set(entry.key, intValue);
        }
    }

    /**
     * Determine byte width based on control type and options
     */
    getByteWidth(item: CustomUIMenuItem): number {
        // Color controls use 2 bytes (HSV packed)
        if (item.type === 'color') {
            return 2;
        }

        // Range controls: 2 bytes if max > 255
        if (item.type === 'range' && item.options) {
            const options = item.options as number[];
            const max = options[1] ?? 255;
            return max > 255 ? 2 : 1;
        }

        // Keycode controls use 2 bytes
        if (item.type === 'keycode') {
            return 2;
        }

        // Default: 1 byte (toggle, dropdown, button)
        return 1;
    }

    /**
     * Extract all items with their value references from a menu tree
     * Returns both the item (for type/options info) and its value ref
     */
    extractAllItemsWithRefs(items: CustomUIMenuItem[]): { item: CustomUIMenuItem; ref: CustomUIValueRef }[] {
        const results: { item: CustomUIMenuItem; ref: CustomUIValueRef }[] = [];

        for (const item of items) {
            // Check if this item has a value reference (leaf control)
            if (item.content && Array.isArray(item.content) && item.content.length > 0) {
                // Check if content is a value reference array (first element is string key)
                if (typeof item.content[0] === 'string') {
                    const ref = this.parseValueRef(item.content as (string | number)[]);
                    if (ref) {
                        results.push({ item, ref });
                    }
                } else if (typeof item.content[0] === 'object') {
                    // Content is nested menu items, recurse
                    results.push(...this.extractAllItemsWithRefs(item.content as CustomUIMenuItem[]));
                }
            }
        }

        return results;
    }

    /**
     * Convert raw bytes (little-endian) to integer
     */
    bytesToInt(data: number[], width?: number): number {
        const len = width ?? data.length;
        let value = 0;
        for (let i = 0; i < len && i < data.length; i++) {
            value |= data[i] << (i * 8);
        }
        return value;
    }

    /**
     * Convert integer to little-endian byte array
     */
    intToBytes(value: number, width: number): number[] {
        const bytes: number[] = [];
        for (let i = 0; i < width; i++) {
            bytes.push((value >> (i * 8)) & 0xff);
        }
        return bytes;
    }

    /**
     * Get value by key, fetching from keyboard if not cached
     */
    async getValue(key: string, menus: CustomUIMenuItem[]): Promise<number | undefined> {
        // Check cache first
        const cached = this.cache.get(key);
        if (cached !== undefined) {
            return cached;
        }

        // Find the item and ref for this key
        const itemsWithRefs = this.extractAllItemsWithRefs(menus);
        const found = itemsWithRefs.find(({ ref }) => ref.key === key);
        if (!found) {
            console.warn(`Value key not found in menus: ${key}`);
            return undefined;
        }

        // Fetch from keyboard with correct byte width
        const width = this.getByteWidth(found.item);
        const value = await this.get(found.ref.channel, found.ref.valueId, width);
        this.cache.set(key, value);
        return value;
    }

    /**
     * Set value by key
     */
    async setValue(key: string, value: number, menus: CustomUIMenuItem[]): Promise<void> {
        // Find the item and ref for this key
        const itemsWithRefs = this.extractAllItemsWithRefs(menus);
        const found = itemsWithRefs.find(({ ref }) => ref.key === key);
        if (!found) {
            console.warn(`Value key not found in menus: ${key}`);
            return;
        }

        // Set on keyboard with correct byte width
        const width = this.getByteWidth(found.item);
        await this.set(found.ref.channel, found.ref.valueId, value, width);

        // Update cache
        this.cache.set(key, value);
    }
}

// Export singleton instance
export const customValueService = new CustomValueService(usbInstance);
