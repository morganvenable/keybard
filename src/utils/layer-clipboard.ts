import { keymapFromStored, keymapToNames } from '@/utils/stored-keymap';

export interface LayerClipboardData {
    keymap: number[];
    layerColor?: string;
    ledColor?: { hue: number; sat: number; val: number };
}

/** Accepts keycode names (what Keybard copies) or numbers (older copies). */
export function parseLayerClipboard(value: unknown): LayerClipboardData {
    const data = (Array.isArray(value) ? { keymap: value } : value) as Omit<LayerClipboardData, 'keymap'> & { keymap: unknown };
    let keymap: number[];
    try {
        keymap = keymapFromStored(data?.keymap);
    } catch {
        throw new Error('The clipboard does not contain a valid keyboard layer.');
    }
    if (!keymap.length) throw new Error('The clipboard does not contain a valid keyboard layer.');
    if (data.layerColor !== undefined && typeof data.layerColor !== 'string') throw new Error('Invalid layer color in clipboard.');
    if (data.ledColor && !['hue', 'sat', 'val'].every(key => {
        const value = data.ledColor![key as keyof typeof data.ledColor];
        return Number.isInteger(value) && value >= 0 && value <= 255;
    })) throw new Error('Invalid LED color in clipboard.');
    return structuredClone({ keymap, layerColor: data.layerColor, ledColor: data.ledColor });
}

let fallback: LayerClipboardData | null = null;
let fallbackOnly = false;
let copyVersion = 0;

/** Keep in-app copying usable when browser clipboard permission is unavailable. */
export async function writeLayerClipboard(value: LayerClipboardData): Promise<void> {
    const data = parseLayerClipboard(value);
    const version = ++copyVersion;
    fallback = data;
    fallbackOnly = true;
    try {
        await navigator.clipboard.writeText(JSON.stringify({ _type: 'layer', ...data, keymap: keymapToNames(data.keymap) }));
        if (version === copyVersion) fallbackOnly = false;
    } catch { /* The in-app copy remains available. */ }
}

export async function readLayerClipboard(): Promise<LayerClipboardData> {
    if (fallbackOnly && fallback) return structuredClone(fallback);
    let text: string;
    try { text = await navigator.clipboard.readText(); }
    catch {
        if (fallback) return structuredClone(fallback);
        throw new Error('Clipboard access was blocked. Copy a layer in Keybard first, then paste it here.');
    }
    try { return parseLayerClipboard(JSON.parse(text)); }
    catch { throw new Error('The clipboard does not contain a valid keyboard layer.'); }
}
