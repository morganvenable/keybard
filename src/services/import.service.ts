import { KeyboardInfo } from "../types/vial.types";
import { PendingChange } from "./changes.service";
import { customValueService } from "./custom-value.service";
import { LabelService } from "./label.service";
import { usbInstance } from "./usb.service";
import { keyService } from "./key.service";

export class ImportService {
    async syncWithKeyboard(
        newKb: KeyboardInfo,
        currentKb: KeyboardInfo,
        enqueue: (desc: string, cb: () => Promise<void>, metadata?: Partial<PendingChange>) => Promise<void>,
        services: any
    ): Promise<void> {
        if (!currentKb) return;

        // Build the complete write set before executing anything. Live mode then sees
        // one batch, so a partial import cannot be acknowledged as fully saved.
        const writes: Array<{ desc: string; cb: () => Promise<void>; metadata?: Partial<PendingChange> }> = [];
        const queue = async (desc: string, cb: () => Promise<void>, metadata?: Partial<PendingChange>) => { writes.push({ desc, cb, metadata }); };

        // Copy hardware properties from connected keyboard (these are not in save files)
        // macros_size is required for the macro buffer allocation
        newKb.macros_size = currentKb.macros_size;

        // 1. Sync Keymap
        // Use hardware dimensions from currentKb for iteration
        if (newKb.keymap && currentKb.keymap) {
            const layers = Math.min(newKb.layers || 0, currentKb.layers || 0);
            const rows = currentKb.rows;
            const cols = currentKb.cols;

            for (let l = 0; l < layers; l++) {
                if (!newKb.keymap[l]) continue;
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        // Map using file's cols for reading, hardware cols for writing
                        const newCols = newKb.cols || cols;
                        const keyIndex = (r * newCols) + c;
                        const newVal = newKb.keymap[l][keyIndex];
                        const oldVal = currentKb.keymap?.[l]?.[keyIndex];

                        if (newVal !== undefined && newVal !== oldVal) {
                            const keyLabel = keyService.stringify(newVal);
                            await queue(
                                `Update key L${l} R${r} C${c} to ${keyLabel}`,
                                async () => {
                                    await services.vialService.updateKey(l, r, c, newVal);
                                },
                                {
                                    writeKey: `key:${l}:${r}:${c}`,
                                    type: "key",
                                    layer: l,
                                    row: r,
                                    col: c,
                                    keycode: newVal,
                                    previousValue: oldVal
                                }
                            );
                        }
                    }
                }
            }
        }

        // 2. Sync Macros
        if (JSON.stringify(newKb.macros) !== JSON.stringify(currentKb.macros)) {
            await queue(
                "Update All Macros",
                async () => {
                    await services.vialService.updateMacros(newKb);
                },
                { type: "macro", writeKey: "macros" }
            );
        }

        // 3. Sync Combos
        const newCombos = newKb.combos;
        const currentCombos = currentKb.combos;

        if (newCombos && currentCombos) {
            for (let idx = 0; idx < newCombos.length; idx++) {
                const combo = newCombos[idx];
                const oldCombo = currentCombos[idx];
                if (JSON.stringify(combo) !== JSON.stringify(oldCombo)) {
                    await queue(
                        `Update Combo ${idx}`,
                        async () => {
                            await services.vialService.updateCombo(newKb, idx);
                        },
                        { type: "combo", comboId: idx, writeKey: `combo:${idx}` }
                    );
                }
            }
        }

        // 4. Sync Tapdances
        const newTds = newKb.tapdances;
        const oldTds = currentKb.tapdances;

        if (newTds && oldTds) {
            for (let idx = 0; idx < newTds.length; idx++) {
                const td = newTds[idx];
                const oldTd = oldTds[idx];
                if (JSON.stringify(td) !== JSON.stringify(oldTd)) {
                    await queue(
                        `Update Tapdance ${idx}`,
                        async () => {
                            await services.vialService.updateTapdance(newKb, idx);
                        },
                        { type: "tapdance", tapdanceId: idx, writeKey: `tapdance:${idx}` }
                    );
                }
            }
        }

        // 5. Sync Key Overrides
        const newOverrides = newKb.key_overrides;
        const currentOverrides = currentKb.key_overrides;

        if (newOverrides && currentOverrides) {
            for (let idx = 0; idx < newOverrides.length; idx++) {
                const ko = newOverrides[idx];
                const oldKo = currentOverrides[idx];
                if (JSON.stringify(ko) !== JSON.stringify(oldKo)) {
                    await queue(
                        `Update Key Override ${idx}`,
                        async () => {
                            await services.vialService.updateKeyoverride(newKb, idx);
                        },
                        { type: "override", writeKey: `override:${idx}` }
                    );
                }
            }
        }

        const labels = services.labelService ?? new LabelService(usbInstance);
        if ((currentKb.svil_proto ?? 0) >= 2) {
            for (const [field, kind, count] of [["layer", "layer", currentKb.layers], ["macros", "macro", currentKb.macro_count], ["tapdances", "tapdance", currentKb.tapdance_count]] as const) {
                if (!newKb.cosmetic?.[field]) continue;
                for (let index = 0; index < (count ?? 0); index++) {
                    const name = newKb.cosmetic[field]?.[index] ?? "";
                    if (name === (currentKb.cosmetic?.[field]?.[index] ?? "")) continue;
                    await queue(`Rename ${kind} ${index}`, () => labels.saveName(currentKb, kind, index, name), { type: "key", writeKey: `label:${kind}:${index}` });
                }
            }
        }

        // 6. Sync QMK Settings
        if (newKb.settings && currentKb.settings) {
            for (const key of Object.keys(newKb.settings)) {
                const qsid = parseInt(key);
                const newVal = newKb.settings![qsid];
                const oldVal = currentKb.settings![qsid];

                if (newVal !== oldVal) {
                    await queue(
                        `Update QMK Setting ${qsid}`,
                        async () => {
                            await services.vialService.updateQMKSetting(newKb, qsid);
                        },
                        { type: "key", writeKey: `setting:${qsid}` }
                    );
                }
            }
        }

        // 7. Sync VIA3 Custom Values (DPI, scroll mode, automouse, bump filter, etc.)
        if (newKb.custom_values && newKb.custom_values.length > 0 && currentKb.menus) {
            // Walk connected keyboard's menu tree to get channel/valueId/width for each key
            const menuItemsWithRefs = customValueService.extractAllItemsWithRefs(currentKb.menus);
            const menuRefMap = new Map(menuItemsWithRefs.map(({ item, ref }) => [ref.key, { item, ref }]));

            const channelsToSave = new Set<number>();

            for (const entry of newKb.custom_values) {
                const menuEntry = menuRefMap.get(entry.key);
                if (!menuEntry) {
                    console.warn(`[Import] Custom value key "${entry.key}" not found in connected keyboard menus, skipping`);
                    continue;
                }

                const { item, ref } = menuEntry;
                const width = customValueService.getByteWidth(item);

                // Prepare data bytes - handle backward compat:
                // Old format: data: [integer] where the single number is the full value
                // New format: data: [byte0, byte1, ...] raw little-endian bytes
                let dataBytes: number[];
                if (entry.data.length === 1 && width > 1) {
                    // Old format: single integer, expand to bytes
                    dataBytes = customValueService.intToBytes(entry.data[0], width);
                } else {
                    dataBytes = entry.data.slice(0, width);
                    // Pad if needed
                    while (dataBytes.length < width) {
                        dataBytes.push(0);
                    }
                }

                await queue(
                    `Update custom value ${entry.key}`,
                    async () => {
                        await customValueService.setRaw(ref.channel, ref.valueId, dataBytes);
                    },
                    { type: "custom_ui" as any, writeKey: `custom:${entry.key}` }
                );

                channelsToSave.add(ref.channel);
            }

            // Save each affected channel
            for (const channel of channelsToSave) {
                await queue(
                    `Save custom values channel ${channel}`,
                    async () => {
                        await customValueService.save(channel);
                    },
                    { type: "custom_ui" as any, writeKey: `custom-save:${channel}` }
                );
            }
        }
        if (writes.length) {
            await queue("Save imported configuration", () => services.vialService.saveSvil(), { type: "key", writeKey: "save-svil" });
        }
        await Promise.all(writes.map(write => enqueue(write.desc, write.cb, write.metadata)));
    }
}

export const importService = new ImportService();
