import type { CustomValueEntry, KeyboardInfo } from "../types/vial.types";
import { ComboOptions } from "../types/vial.types";
import { getClosestPresetColor } from "../utils/color-conversion";
import { FragmentComposerService } from "./fragment-composer.service";
import { FragmentService } from "./fragment.service";
import { keyService } from "./key.service";
import { KleService } from "./kle.service";

// Default template for KBINFO if needed (simplified from SVALBOARD)
const DEFAULT_KB_INFO: any = {
    cols: 6,
    combo_count: 50,
    combos: [],
    key_override_count: 30,
    key_overrides: [],
    macro_count: 16,
    macros: [],
    tapdance_count: 10,
    tapdances: [],
    layers: 4,
    rows: 4,
    keymap: [],
    filters: [],
    // Add other default fields as necessary based on SVALBOARD
    settings: {} as any,
    uid: "0",
    name: "Unknown",
    layout_options: -1
};

export class FileService {
    private static readonly MAX_FILE_SIZE = 1048576; // 1MB
    private kleService: KleService;

    constructor() {
        this.kleService = new KleService();
    }

    async loadFile(file: File): Promise<KeyboardInfo> {
        await this.validateFile(file);
        const content = await this.readFile(file);
        // Use parseContent to handle all file formats (.vil, .svil)
        return this.parseContent(content);
    }

    private async validateFile(file: File): Promise<void> {
        if (file.size > FileService.MAX_FILE_SIZE) {
            throw new Error("File too large");
        }
    }

    private async readFile(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (event) => {
                if (event.target?.result) {
                    resolve(event.target.result as string);
                } else {
                    reject(new Error("Failed to read file"));
                }
            };

            reader.onerror = () => {
                reject(new Error("Failed to read file"));
            };

            reader.readAsText(file);
        });
    }

    private normalizeKeymap(kbinfo: KeyboardInfo): void {
        // If keymap exists and has string values, convert them to numbers
        if (kbinfo.keymap && Array.isArray(kbinfo.keymap)) {
            kbinfo.keymap = kbinfo.keymap.map((layer) => {
                if (Array.isArray(layer)) {
                    return layer.map((keycode) => {
                        // If it's a string, parse it to a number
                        if (typeof keycode === "string") {
                            return keyService.parse(keycode);
                        }
                        // If it's already a number, keep it
                        return keycode;
                    });
                }
                return layer;
            });
        }
    }

    async downloadVIL(kbinfo: KeyboardInfo, includeMacros: boolean = true): Promise<void> {
        const vil = this.kbinfoToVIL(structuredClone(kbinfo), includeMacros);
        await this.downloadTEXT(vil, {
            suggestedName: includeMacros ? 'keyboard.vil' : 'keyboard-nomacro.vil',
            types: [{
                description: 'Vial .vil files',
                accept: {
                    'text/vial': ['.vil'],
                },
            }],
        });
    }

    async downloadSvil(kbinfo: KeyboardInfo, includeMacros: boolean = true): Promise<void> {
        const viable = this.kbinfoToViable(structuredClone(kbinfo), includeMacros);
        await this.downloadTEXT(viable, {
            suggestedName: includeMacros ? 'keyboard.svil' : 'keyboard-nomacro.svil',
            types: [{
                description: 'Svalboard layout files',
                accept: {
                    'application/json': ['.svil'],
                },
            }],
        });
    }

    async downloadKeymapH(_kbinfo: KeyboardInfo): Promise<void> {
        // TODO: Implement kbinfoToCKeymap logic here or import it if available
        // For now, leaving as placeholder or assuming global exists (which we should avoid)
        // const content = kbinfoToCKeymap(kbinfo);
        // await this.downloadTEXT(content, { ... });
        console.warn("downloadKeymapH not fully migrated yet");
    }

    private async downloadTEXT(content: string, opts: any) {
        try {
            if ((window as any).showSaveFilePicker) {
                const handle = await (window as any).showSaveFilePicker(opts);
                const writable = await handle.createWritable();
                const blob = new Blob([content], { type: 'text/plain' });
                await writable.write(blob);
                await writable.close();
            } else {
                // Fallback
                const blob = new Blob([content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', opts.suggestedName || 'download.txt');
                link.setAttribute('target', '_blank');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (err) {
            console.error("Error saving file", err);
        }
    }

    // --- Upload Logic ---

    async uploadFile(file: File): Promise<KeyboardInfo> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const content = evt.target?.result as string;
                    if (!content) return reject("Empty file");
                    const parsed = this.parseContent(content);
                    resolve(parsed);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject("Error reading file");
            reader.readAsText(file);
        });
    }

    parseContent(content: string): KeyboardInfo {
        // Extract raw UID before JSON.parse (which loses precision on large numbers)
        const uidMatch = content.match(/"uid"\s*:\s*(\d+)/);
        const rawUidStr = uidMatch ? uidMatch[1] : null;

        const js = JSON.parse(content);
        let kbinfo: KeyboardInfo | null = null;

        if (js.uid && (js.viable_protocol !== undefined || js.version === 1)) {
            // It's a .svil / legacy .viable file (has uid + viable_protocol or version: 1)
            kbinfo = this.viableToKBINFO(js);
        } else if (js.uid) {
            // It's a .vil (has uid but no viable_protocol)
            kbinfo = this.vilToKBINFO(js);
        } else {
            throw new Error('Unknown file format. Expected .svil (or legacy .viable) or .vil file.');
        }

        // Restore precise UID (JSON.parse loses precision on large integers)
        if (rawUidStr && kbinfo) {
            kbinfo.kbid = BigInt(rawUidStr).toString(16);
        }

        // Deserialize layout using KLE logic
        // We assume convertVIL layout to keymap handled key codes, 
        // but we might need to populate 'keylayout' for UI.
        // In the original code: kbinfo.keylayout = KLE.deserializeToKeylayout(kbinfo, kbinfo.payload.layouts.keymap);
        // We need to implement deserializeToKeylayout.

        // This part depends on where 'payload.layouts.keymap' comes from. 
        // In .vil upload, standard .vil doesn't have QMK payload. 
        // .kbi usually does.

        if (kbinfo.payload?.layouts?.keymap) {
            kbinfo.keylayout = this.deserializeToKeylayout(kbinfo, kbinfo.payload.layouts.keymap as any);
        }

        // Normalize keycodes (string -> number) if necessary
        this.normalizeKeymap(kbinfo);

        return kbinfo;
    }

    // --- Conversion Logic ---

    kbinfoToVIL(kbinfo: KeyboardInfo, includeMacros: boolean): string {
        let macros: any[];
        if (includeMacros && kbinfo.macros) {
            macros = (kbinfo.macros as any).map((macro: any) => macro.actions);
        } else {
            macros = new Array(kbinfo.macro_count).fill([]);
        }

        const kbidrepl = "BiGKBidGoesHere";
        const vil: any = {
            combo: kbinfo.combos,
            encoder_layout: new Array(16).fill([]), // TODO: check encoder count
            key_override: (kbinfo.key_overrides as any)?.map((ko: any) => {
                const { ...rest } = ko;
                // @ts-ignore
                delete rest.koid;
                return rest;
            }) || [],
            layout_options: -1,
            macro: macros,
            settings: kbinfo.settings,
            tap_dance: (kbinfo.tapdances as any)?.map((td: any) => [td.tap, td.hold, td.doubletap, td.taphold, td.tapms]) || [],
            uid: kbidrepl,
            version: 1,
            via_protocol: 12,
            vial_protocol: 6,
        };

        // Layout conversion
        vil.layout = [];
        if (kbinfo.keymap && kbinfo.rows && kbinfo.cols) {
            for (let l = 0; l < (kbinfo.layers || 0); l++) {
                const km = kbinfo.keymap[l];
                const layer = [];
                for (let r = 0; r < kbinfo.rows; r++) {
                    const row = [];
                    for (let c = 0; c < kbinfo.cols; c++) {
                        // Use keyService to convert keycode to string (vilify logic)
                        // Assuming keyService.stringify is compatible or we need custom logic
                        row.push(keyService.stringify(km[(r * kbinfo.cols) + c]));
                    }
                    layer.push(row);
                }
                vil.layout.push(layer);
            }
        }

        let jsvil = JSON.stringify(vil, undefined, 2);
        // Replace placeholder with numeric UID (viable expects number)
        // Use BigInt to handle 64-bit UIDs without precision loss
        const numericUid = kbinfo.kbid ? BigInt('0x' + kbinfo.kbid).toString() : '0';
        jsvil = jsvil.replace('"' + kbidrepl + '"', numericUid);
        return jsvil;
    }

    /**
     * Convert KeyboardInfo to .svil format (native Svalboard layout format; same JSON structure as viable-gui's .viable)
     * This format preserves all Viable-specific features
     */
    kbinfoToViable(kbinfo: KeyboardInfo, includeMacros: boolean = true): string {
        // Build layout array [layers][rows][cols]
        const layout: string[][][] = [];
        if (kbinfo.keymap && kbinfo.rows && kbinfo.cols) {
            for (let l = 0; l < (kbinfo.layers || 0); l++) {
                const layerArr: string[][] = [];
                const km = kbinfo.keymap[l];
                for (let r = 0; r < kbinfo.rows; r++) {
                    const rowArr: string[] = [];
                    for (let c = 0; c < kbinfo.cols; c++) {
                        rowArr.push(keyService.stringify(km[(r * kbinfo.cols) + c]));
                    }
                    layerArr.push(rowArr);
                }
                layout.push(layerArr);
            }
        }

        // Build macros
        // Sanitize text actions to ASCII-only (32-126) for viable-gui compatibility
        const sanitizeText = (text: string): string => {
            return text.split('').filter(c => {
                const code = c.charCodeAt(0);
                return code >= 32 && code <= 126;
            }).join('');
        };

        let macros: any[];
        if (includeMacros && kbinfo.macros) {
            macros = kbinfo.macros.map((macro: any) => {
                const actions = macro.actions || [];
                return actions.map((action: any) => {
                    if (Array.isArray(action) && action[0] === 'text') {
                        // Sanitize text content to ASCII-only
                        return ['text', sanitizeText(action[1] || '')];
                    }
                    return action;
                }).filter((action: any) => {
                    // Remove empty text actions
                    if (Array.isArray(action) && action[0] === 'text' && !action[1]) {
                        return false;
                    }
                    return true;
                });
            });
        } else {
            macros = new Array(kbinfo.macro_count || 0).fill([]);
        }

        // Build tap dances (dict format with "on" flag)
        // Tap dance values are stored as strings, use them directly
        const tapDances = (kbinfo.tapdances || []).map((td: any) => ({
            on: true, // Keybard always enables tap dances
            on_tap: typeof td.tap === 'string' ? td.tap : keyService.stringify(td.tap || 0),
            on_hold: typeof td.hold === 'string' ? td.hold : keyService.stringify(td.hold || 0),
            on_double_tap: typeof td.doubletap === 'string' ? td.doubletap : keyService.stringify(td.doubletap || 0),
            on_tap_hold: typeof td.taphold === 'string' ? td.taphold : keyService.stringify(td.taphold || 0),
            tapping_term: td.tapping_term || 200,
        }));

        // Build combos (dict format with "on" flag).
        // In-memory combos use a single uint16 `options` field (bit 15 = enabled,
        // bits 0-14 = combo term) matching the wire format. Decompose for the
        // file's separate on/combo_term fields.
        const combos = (kbinfo.combos || []).map((c: any) => {
            const opts = (c.options ?? 0) >>> 0;
            return {
                on: (opts & ComboOptions.ENABLED) !== 0,
                keys: (c.keys || []).map((k: any) => typeof k === 'string' ? k : keyService.stringify(k)),
                output: typeof c.output === 'string' ? c.output : keyService.stringify(c.output || 0),
                combo_term: opts & 0x7FFF,
            };
        });

        // Build key overrides (dict format with "on" flag)
        const keyOverrides = (kbinfo.key_overrides || []).map((ko: any) => ({
            on: ko.enabled !== false,
            trigger: typeof ko.trigger === 'string' ? ko.trigger : keyService.stringify(ko.trigger || 0),
            replacement: typeof ko.replacement === 'string' ? ko.replacement : keyService.stringify(ko.replacement || 0),
            layers: ko.layers ?? 0xFFFF,
            trigger_mods: ko.trigger_mods || 0,
            negative_mod_mask: ko.negative_mod_mask || 0,
            suppressed_mods: ko.suppressed_mods || 0,
            options: ko.options || 0,
        }));

        // Build alt repeat keys (Viable-specific)
        const altRepeatKeys = (kbinfo.alt_repeat_keys || []).map((ark: any) => ({
            on: ark.enabled !== false,
            keycode: typeof ark.keycode === 'string' ? ark.keycode : keyService.stringify(ark.keycode || 0),
            alt_keycode: typeof ark.alt_keycode === 'string' ? ark.alt_keycode : keyService.stringify(ark.alt_keycode || 0),
            allowed_mods: ark.allowed_mods || 0,
            options: ark.options || 0,
        }));

        // Build leaders (Viable-specific)
        const leaders = (kbinfo.leaders || []).map((ldr: any) => ({
            on: ldr.enabled !== false,
            sequence: (ldr.sequence || []).map((k: any) => typeof k === 'string' ? k : keyService.stringify(k)),
            output: typeof ldr.output === 'string' ? ldr.output : keyService.stringify(ldr.output || 0),
            options: ldr.options || 0,
        }));

        // Build one-shot settings
        const oneshot = kbinfo.one_shot ? {
            timeout: kbinfo.one_shot.timeout || 0,
            tap_toggle: kbinfo.one_shot.tap_toggle || 0,
        } : null;

        // Build the .svil structure
        // Use placeholder for UID since we need BigInt for 64-bit precision
        const uidPlaceholder = "UID_PLACEHOLDER_FOR_BIGINT";
        const viable: any = {
            version: 1,
            uid: uidPlaceholder,
            layout,
            encoder_layout: [], // TODO: implement encoder support
            layout_options: -1,
            macro: macros,
            viable_protocol: kbinfo.viable_proto || 1,
            via_protocol: kbinfo.via_proto || 12,
            tap_dance: tapDances,
            combo: combos,
            key_override: keyOverrides,
            alt_repeat_key: altRepeatKeys,
            leader: leaders,
            settings: kbinfo.settings || {},
        };

        // Only include oneshot if present
        if (oneshot) {
            viable.oneshot = oneshot;
        }

        // Save resolved fragment selections for each instance (not just user selections)
        // This captures hardware-detected, EEPROM, or user-selected fragments
        if (kbinfo.composition?.instances && kbinfo.fragments) {
            const fragmentService = new FragmentService(null as any); // No USB needed
            const resolvedSelections: Record<string, string> = {};
            const getUserSelection = (instanceId: string): string | undefined => {
                const selections = kbinfo.fragmentState?.userSelections;
                if (!selections) return undefined;
                if (selections instanceof Map) {
                    return selections.get(instanceId);
                }
                return (selections as Record<string, string>)[instanceId];
            };

            kbinfo.composition.instances.forEach((instance, idx) => {
                if (instance.fragment_options) {
                    const userSelection = getUserSelection(instance.id);
                    const hasUserSelection = userSelection
                        ? instance.fragment_options.some((opt) => opt.fragment === userSelection)
                        : false;
                    const resolved = hasUserSelection
                        ? userSelection!
                        : fragmentService.resolveFragment(kbinfo, idx, instance);
                    if (resolved) {
                        resolvedSelections[instance.id] = resolved;
                    }
                }
            });

            if (Object.keys(resolvedSelections).length > 0) {
                viable.fragment_selections = resolvedSelections;
            }
        }

        // Save fragment definitions and composition for offline loading
        if (kbinfo.fragments) {
            viable.fragments = kbinfo.fragments;
        }
        if (kbinfo.composition) {
            viable.composition = kbinfo.composition;
        }

        // Save keylayout for physical key positions (needed for proper rendering)
        if (kbinfo.keylayout) {
            viable.keylayout = kbinfo.keylayout;
        }

        // Save VIA3 dynamic menus (pointing device settings, etc.)
        if (kbinfo.menus) {
            viable.menus = kbinfo.menus;
        }

        // Save cosmetic data (layer names, etc.)
        if (kbinfo.cosmetic) {
            viable.cosmetic = kbinfo.cosmetic;
        }

        // Save custom values (VIA3 dynamic menu values + layer colors)
        // Uses kbinfo.custom_values which are loaded at connect time with raw bytes
        const customValues: Array<{ key: string; channel: number; valueId: number; data: number[] }> = [];

        // Save layer colors from kbinfo.layer_colors (matching viable-gui format)
        if (kbinfo.layer_colors && kbinfo.layer_colors.length > 0) {
            kbinfo.layer_colors.forEach((color, idx) => {
                if (color && (color.hue !== 0 || color.sat !== 0)) {
                    customValues.push({
                        key: `id_layer${idx}_color`,
                        channel: 0,
                        valueId: idx, // layer color index
                        data: [color.hue, color.sat]
                    });
                }
            });
        }

        // Save all VIA3 custom values from kbinfo (loaded at connect time)
        if (kbinfo.custom_values) {
            for (const entry of kbinfo.custom_values) {
                // Skip layer colors (already handled above)
                if (entry.key.match(/^id_layer\d+_color$/)) continue;
                customValues.push({
                    key: entry.key,
                    channel: entry.channel,
                    valueId: entry.valueId,
                    data: entry.data,
                });
            }
        }

        if (customValues.length > 0) {
            viable.custom_values = customValues;
        }

        // Stringify and replace UID placeholder with BigInt value (no quotes)
        let result = JSON.stringify(viable, undefined, 2);
        const numericUid = kbinfo.kbid ? BigInt('0x' + kbinfo.kbid).toString() : '0';
        result = result.replace('"' + uidPlaceholder + '"', numericUid);
        return result;
    }

    vilToKBINFO(vil: any): KeyboardInfo {
        // Start with default structure
        const kbinfo: KeyboardInfo = structuredClone(DEFAULT_KB_INFO) as KeyboardInfo;

        // Update counts
        kbinfo.key_override_count = vil.key_override?.length || 0;
        kbinfo.combo_count = vil.combo?.length || 0;
        kbinfo.macro_count = vil.macro?.length || 0;
        kbinfo.tapdance_count = vil.tap_dance?.length || 0;

        // Update values
        kbinfo.combos = vil.combo;
        kbinfo.key_overrides = vil.key_override;
        kbinfo.macros = vil.macro.map((macro: any[], mid: number) => {
            const actions: any[] = [];
            for (const act of macro) {
                // Format: [type, param1, param2...] - varies by macro type
                // In simple text macros often structure is [[type, val], ...]
                // We need to match what files.js expects: { actions: [[type, val]...], mid }
                // The incoming VIL macro is array of actions.
                // Actually, original code says:
                /*
                   for (const act of macro) {
                       for (let i = 1; i < act.length; i++) {
                       actions.push([act[0], act[i]]);
                       }
                   }
                */
                // Wait, this looks like it flattens [type, val1, val2] into [type, val1], [type, val2]?
                // This seems specific to how VIL stores macros. I'll copy the logic.
                if (Array.isArray(act)) {
                    for (let i = 1; i < act.length; i++) {
                        actions.push([act[0], act[i]]);
                    }
                }
            }
            return { actions: actions, mid: mid };
        });

        kbinfo.settings = vil.settings;
        kbinfo.tapdances = vil.tap_dance.map((td: any[], tdid: number) => {
            return {
                idx: tdid,
                tap: td[0],
                hold: td[1],
                doubletap: td[2],
                taphold: td[3],
                tapping_term: td[4]
            };
        });

        // Convert layout to keymap
        // vil.layout is [layer][row][col] -> string
        const km: number[][] = [];
        const keylayout: any[] = [];
        if (vil.layout) {
            // Determine rows/cols from layout if not set
            const layers = vil.layout.length;
            const rows = vil.layout[0]?.length || 0;
            const cols = vil.layout[0]?.[0]?.length || 0;

            kbinfo.layers = layers;
            kbinfo.rows = kbinfo.rows || rows;
            kbinfo.cols = kbinfo.cols || cols;

            for (let l = 0; l < layers; l++) {
                km.push([]);
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        const keyStr = vil.layout[l][r][c];
                        // Handle -1 as KC_NO (unused key position)
                        let keycode: number;
                        if (keyStr === -1) {
                            keycode = 0; // KC_NO
                        } else if (typeof keyStr === 'string') {
                            keycode = keyService.parse(keyStr);
                        } else {
                            keycode = keyStr;
                        }
                        km[l][(r * cols) + c] = keycode;

                        // Generate default keylayout (only need once, e.g. for layer 0)
                        if (l === 0) {
                            keylayout.push({
                                x: c,
                                y: r,
                                w: 1,
                                h: 1,
                                label: "",
                                matrix: [(r * cols) + c] // simplified matrix mapping
                            });
                        }
                    }
                }
            }
        }
        kbinfo.keymap = km;
        (kbinfo as any).keylayout = keylayout;
        kbinfo.kbid = '' + vil.uid;

        return kbinfo;
    }

    /**
     * Convert .svil format to KeyboardInfo
     * .svil (formerly .viable) uses viable-gui's dict-style entries
     */
    viableToKBINFO(viable: any): KeyboardInfo {
        const kbinfo: KeyboardInfo = structuredClone(DEFAULT_KB_INFO) as KeyboardInfo;

        // Store protocol versions
        kbinfo.viable_proto = viable.viable_protocol || 1;
        kbinfo.via_proto = viable.via_protocol || 12;

        // Update counts from data
        kbinfo.key_override_count = viable.key_override?.length || 0;
        kbinfo.combo_count = viable.combo?.length || 0;
        kbinfo.macro_count = viable.macro?.length || 0;
        kbinfo.tapdance_count = viable.tap_dance?.length || 0;
        kbinfo.alt_repeat_key_count = viable.alt_repeat_key?.length || 0;
        kbinfo.leader_count = viable.leader?.length || 0;

        // Convert combos (dict format with "on" flag) into the in-memory shape
        // (single uint16 `options`, bit 15 = enabled, bits 0-14 = combo term).
        kbinfo.combos = (viable.combo || []).map((c: any, cmbid: number) => {
            const term = (c.combo_term || 0) & 0x7FFF;
            const enabled = c.on !== false;
            return {
                cmbid,
                keys: c.keys || [],
                output: c.output,
                options: term | (enabled ? ComboOptions.ENABLED : 0),
            };
        });

        // Convert key overrides (dict format)
        kbinfo.key_overrides = (viable.key_override || []).map((ko: any, koid: number) => ({
            koid,
            enabled: ko.on !== false,
            trigger: ko.trigger,
            replacement: ko.replacement,
            layers: ko.layers || 0xFFFF,
            trigger_mods: ko.trigger_mods || 0,
            negative_mod_mask: ko.negative_mod_mask || 0,
            suppressed_mods: ko.suppressed_mods || 0,
            options: ko.options || 0,
        }));

        // Convert macros
        kbinfo.macros = (viable.macro || []).map((macro: any[], mid: number) => {
            const actions: any[] = [];
            for (const act of macro) {
                if (Array.isArray(act)) {
                    for (let i = 1; i < act.length; i++) {
                        actions.push([act[0], act[i]]);
                    }
                }
            }
            return { actions, mid };
        });

        // Convert tap dances (dict format with "on" flag)
        // Keep tap/hold/doubletap/taphold as strings (that's what the UI expects)
        kbinfo.tapdances = (viable.tap_dance || []).map((td: any, tdid: number) => ({
            idx: tdid,
            enabled: td.on !== false,
            tap: td.on_tap || 'KC_NO',
            hold: td.on_hold || 'KC_NO',
            doubletap: td.on_double_tap || 'KC_NO',
            taphold: td.on_tap_hold || 'KC_NO',
            tapping_term: td.tapping_term || 200,
        }));

        // Convert alt repeat keys (Viable-specific)
        kbinfo.alt_repeat_keys = (viable.alt_repeat_key || []).map((ark: any, arkid: number) => ({
            arkid,
            enabled: ark.on !== false,
            keycode: typeof ark.keycode === 'string' ? ark.keycode : keyService.stringify(ark.keycode || 0),
            alt_keycode: typeof ark.alt_keycode === 'string' ? ark.alt_keycode : keyService.stringify(ark.alt_keycode || 0),
            allowed_mods: ark.allowed_mods || 0,
            options: ark.options || 0,
        }));

        // Convert leaders (Viable-specific)
        kbinfo.leaders = (viable.leader || []).map((ldr: any, ldrid: number) => ({
            ldrid,
            enabled: ldr.on !== false,
            sequence: (ldr.sequence || []).map((k: any) => typeof k === 'string' ? k : keyService.stringify(k || 0)),
            output: typeof ldr.output === 'string' ? ldr.output : keyService.stringify(ldr.output || 0),
            options: ldr.options || 0,
        }));

        // Convert one-shot settings (Viable-specific)
        if (viable.oneshot) {
            kbinfo.one_shot = {
                timeout: viable.oneshot.timeout || 0,
                tap_toggle: viable.oneshot.tap_toggle || 0,
            };
        }

        kbinfo.settings = viable.settings || {};

        // Convert layout to keymap
        const km: number[][] = [];
        const keylayout: any[] = [];
        if (viable.layout) {
            const layers = viable.layout.length;
            const rows = viable.layout[0]?.length || 0;
            const cols = viable.layout[0]?.[0]?.length || 0;

            kbinfo.layers = layers;
            kbinfo.rows = rows;
            kbinfo.cols = cols;

            for (let l = 0; l < layers; l++) {
                km.push([]);
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        const keyStr = viable.layout[l][r][c];
                        // Handle -1 as KC_NO (unused key position)
                        let keycode: number;
                        if (keyStr === -1) {
                            keycode = 0; // KC_NO
                        } else if (typeof keyStr === 'string') {
                            keycode = keyService.parse(keyStr);
                        } else {
                            keycode = keyStr;
                        }
                        km[l][(r * cols) + c] = keycode;

                        if (l === 0) {
                            keylayout.push({
                                x: c,
                                y: r,
                                w: 1,
                                h: 1,
                                label: "",
                                matrix: [(r * cols) + c]
                            });
                        }
                    }
                }
            }
        }
        kbinfo.keymap = km;
        kbinfo.kbid = '' + viable.uid;

        // Restore keylayout from file if available, otherwise use generated fallback
        if (viable.keylayout) {
            kbinfo.keylayout = viable.keylayout;
            console.log("Loaded keylayout from file:", Object.keys(viable.keylayout).length, "keys");
        } else {
            kbinfo.keylayout = keylayout;
        }

        // Restore VIA3 dynamic menus (pointing device settings, etc.)
        if (viable.menus) {
            kbinfo.menus = viable.menus;
        }

        // Restore cosmetic data (layer names, etc.)
        if (viable.cosmetic) {
            kbinfo.cosmetic = viable.cosmetic;
        }

        // Restore fragment definitions and composition
        if (viable.fragments) {
            kbinfo.fragments = viable.fragments;
        }
        if (viable.composition) {
            kbinfo.composition = viable.composition;
        }

        // Restore fragment selections if present
        if (viable.fragment_selections) {
            kbinfo.fragmentState = {
                hwDetection: new Map(),
                eepromSelections: new Map(),
                userSelections: new Map(Object.entries(viable.fragment_selections)),
            };
        }

        // Restore custom_values (layer colors + VIA3 menu values)
        if (viable.custom_values && Array.isArray(viable.custom_values)) {
            const layerColors: Array<{ hue: number; sat: number; val: number }> = [];
            const customValues: CustomValueEntry[] = [];

            for (const cv of viable.custom_values) {
                // Check if it's a layer color value (id_layerX_color)
                const match = cv.key?.match(/^id_layer(\d+)_color$/);
                if (match && Array.isArray(cv.data) && cv.data.length >= 2) {
                    const layerIdx = parseInt(match[1], 10);
                    layerColors[layerIdx] = {
                        hue: cv.data[0],
                        sat: cv.data[1],
                        val: 255,
                    };
                } else if (cv.key && Array.isArray(cv.data) && cv.data.length >= 1) {
                    // Non-layer-color custom value (pointing device settings, etc.)
                    // New format has channel/valueId; old format has only key + data
                    customValues.push({
                        key: cv.key,
                        channel: cv.channel ?? 0,
                        valueId: cv.valueId ?? 0,
                        data: cv.data,
                    });
                }
            }

            if (layerColors.length > 0) {
                kbinfo.layer_colors = layerColors;
                console.log("Restored layer_colors from file:", layerColors.length, "colors");

                if (!kbinfo.cosmetic) {
                    kbinfo.cosmetic = { layer: {}, layer_colors: {} };
                }
                if (!kbinfo.cosmetic.layer_colors) {
                    kbinfo.cosmetic.layer_colors = {};
                }
                layerColors.forEach((c, idx) => {
                    if (c) {
                        const presetName = getClosestPresetColor(c.hue, c.sat, c.val);
                        kbinfo.cosmetic!.layer_colors![idx.toString()] = presetName;
                    }
                });
                console.log("Cosmetic layer colors restored:", kbinfo.cosmetic.layer_colors);
            }

            if (customValues.length > 0) {
                kbinfo.custom_values = customValues;
                console.log("Restored custom values from file:", customValues.length, "entries");
            }
        }

        // Compose layout from fragments if available
        if (kbinfo.fragments && kbinfo.composition) {
            try {
                const fragmentService = new FragmentService(null as any); // No USB needed for offline
                const fragmentComposer = new FragmentComposerService(this.kleService, fragmentService);
                if (fragmentComposer.hasFragments(kbinfo)) {
                    const composedLayout = fragmentComposer.composeLayout(kbinfo);
                    if (Object.keys(composedLayout).length > 0) {
                        kbinfo.keylayout = composedLayout;
                        console.log("Fragment layout composed from file:", Object.keys(composedLayout).length, "keys");
                    }
                }
            } catch (e) {
                console.warn("Failed to compose fragment layout from file:", e);
            }
        }

        return kbinfo;
    }

    // Minimal implementation of KLE deserializeToKeylayout
    // For full support, we might need the full KLE library logic.
    // This is a simplified version based on `kle.js` snippet logic.
    // Simplified KLE Deserializer to KeyLayout
    private deserializeToKeylayout(kbinfo: KeyboardInfo, rows: any[]): any {
        return this.kleService.deserializeToKeylayout(kbinfo, rows);
    }
}

export const fileService = new FileService();
