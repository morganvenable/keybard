import { connectHostKeyboard, hostKeyboards, isHostPage, type ConnectableKeyboard } from "@/features/trainer/hostConnection";
import { SvalPreviewRequiredError } from "../services/firmware-compatibility";
import { SvalCompatibilityNotice } from "../components/SvalCompatibilityNotice";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { VialService, vialService } from "../services/vial.service";
import { svalService } from "../services/sval.service";

import { fileService } from "../services/file.service";
import { keyService } from "../services/key.service";
import { qmkService } from "../services/qmk.service";
import { usbInstance } from "../services/usb.service";
import { customValueService } from "../services/custom-value.service";
import { getClosestPresetColor } from "../utils/color-conversion";
import type { KeyboardInfo } from "../types/vial.types";

interface VialContextType {
    keyboard: KeyboardInfo | null;
    setKeyboard: React.Dispatch<React.SetStateAction<KeyboardInfo | null>>;
    originalKeyboard: KeyboardInfo | null;
    resetToOriginal: () => void;
    markAsSaved: () => void;
    hasUnsavedChanges: boolean;
    isConnected: boolean;
    isWebHIDSupported: boolean;
    isImporting: boolean;
    setIsImporting: React.Dispatch<React.SetStateAction<boolean>>;
    loadedFrom: string | null;
    connect: (filters?: HIDDeviceFilter[]) => Promise<boolean>;
    /** Open an already-permitted device (from listPermittedDevices) without the chooser. */
    connectDevice: (device: ConnectableKeyboard) => Promise<boolean>;
    disconnect: () => Promise<void>;
    loadKeyboard: () => Promise<void>;
    loadFromFile: (file: File) => Promise<void>;
    updateKey: (layer: number, row: number, col: number, keymask: number) => Promise<void>;
    pollMatrix: () => Promise<boolean[][]>;
    lastHeartbeat: number;
    activeLayerIndex: number | null;
}

const VialContext = createContext<VialContextType | undefined>(undefined);

export const DEFAULT_HID_FILTERS: HIDDeviceFilter[] = [
    { usagePage: 0xff61, usage: 0x62 },  // Svil keyboards
    { usagePage: 0xff60, usage: 0x61 },  // Vial keyboards (legacy)
    { usagePage: 0xff60, usage: 0x62 },  // Vial RawHID (legacy)
];

/**
 * Keyboards this origin may open without the chooser: devices the user has
 * already granted, restricted to interfaces matching the given filters, one
 * entry per physical device.
 */
export async function listPermittedDevices(filters: HIDDeviceFilter[] = DEFAULT_HID_FILTERS): Promise<ConnectableKeyboard[]> {
    if (typeof document !== "undefined" && isHostPage()) return hostKeyboards();
    if (typeof navigator === "undefined" || !navigator.hid?.getDevices) return [];
    const devices = await navigator.hid.getDevices();
    const matches = (d: HIDDevice) => d.collections.some((c) => filters.some((f) =>
        (f.vendorId === undefined || d.vendorId === f.vendorId) &&
        (f.productId === undefined || d.productId === f.productId) &&
        (f.usagePage === undefined || c.usagePage === f.usagePage) &&
        (f.usage === undefined || c.usage === f.usage)));
    const seen = new Set<string>();
    return devices.filter((d) => {
        if (!matches(d)) return false;
        const key = `${d.vendorId}:${d.productId}:${d.productName}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export const VialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [compatibilityNotice, setCompatibilityNotice] = useState(false);
    const [releaseFailed, setReleaseFailed] = useState(false);
    const [keyboard, setKeyboard] = useState<KeyboardInfo | null>(null);
    const [originalKeyboard, setOriginalKeyboard] = useState<KeyboardInfo | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [loadedFrom, setLoadedFrom] = useState<string | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [lastHeartbeat, setLastHeartbeat] = useState<number>(0);
    const [activeLayerIndex, setActiveLayerIndex] = useState<number | null>(null);
    const isWebHIDSupported = VialService.isWebHIDSupported();

    // Tracks the in-flight loadKeyboard promise. Multiple components mounted
    // at the same time (VialProvider's own auto-load effect, ConnectKeyboard,
    // KeyboardConnector, ...) all run loadKeyboard on isConnected → fire
    // concurrent Vial protocol reads over the same HID transport. The
    // chunked keyboard-definition fetch can get its chunks interleaved
    // between requests, leaving custom_keycodes (and other payload fields)
    // undefined or partial. Dedupe so callers share a single load.
    const inFlightLoadRef = useRef<Promise<void> | null>(null);

    // Keeps loadFromFile able to read the latest keyboard state without
    // re-binding the callback (which would trigger downstream re-renders
    // every keystroke). Used to merge device-derived structural fields
    // (custom_keycodes, payload, etc.) into file-loaded keymaps.
    const keyboardRef = useRef<KeyboardInfo | null>(null);
    useEffect(() => {
        keyboardRef.current = keyboard;
        console.log("keyboard changed", keyboard);
    }, [keyboard]);

    const afterOpen = useCallback((success: boolean) => {
        if (success) {
            setCompatibilityNotice(false);
            setKeyboard(null);
            setOriginalKeyboard(null);
            keyboardRef.current = null;
            usbInstance.onDisconnect = () => {
                console.log("Disconnect detected via listener");
                setIsConnected(false);
            };
        }
        setIsConnected(success);
        console.log("connected success:", success);
        return success;
    }, []);

    const loadHostSnapshot = useCallback(async (id?: string) => {
        const info = await connectHostKeyboard(id);
        svalService.setupCosmeticLayerNames(info);
        keyService.generateAllKeycodes(info);
        setKeyboard(info);
        setOriginalKeyboard(structuredClone(info));
        setLoadedFrom(`Keyboard snapshot · ${info.name || "Svalboard"}`);
        // This is a read-only snapshot. Never enable direct USB writes or pollers.
        setIsConnected(false);
        return true;
    }, []);

    const connect = useCallback(async (filters?: HIDDeviceFilter[]) => {
        if (isHostPage()) return loadHostSnapshot();
        try {
            return afterOpen(await usbInstance.open(filters || DEFAULT_HID_FILTERS));
        } catch (error) {
            console.error("Failed to connect to keyboard:", error);
            return false;
        }
    }, [afterOpen, loadHostSnapshot]);

    const connectDevice = useCallback(async (device: ConnectableKeyboard) => {
        if (isHostPage()) return loadHostSnapshot("hostId" in device ? device.hostId : undefined);
        if ("hostId" in device) return false;
        try {
            return afterOpen(await usbInstance.openDevice(device));
        } catch (error) {
            console.error("Failed to open permitted keyboard:", error);
            return false;
        }
    }, [afterOpen, loadHostSnapshot]);

    const disconnect = useCallback(async () => {
        try {
            await usbInstance.close();
            setIsConnected(false);
            setLoadedFrom(null);
            setCompatibilityNotice(false);
        } catch (error) {
            console.error("Failed to disconnect:", error);
        }
    }, []);

    const loadKeyboard = useCallback(async () => {
        if (!isConnected) {
            console.log("loadKeyboard not connected");
            throw new Error("USB device not connected");
        }

        // If a load is already in flight, share its promise instead of
        // racing another set of HID reads.
        if (inFlightLoadRef.current) {
            return inFlightLoadRef.current;
        }

        const loadPromise = (async () => {
            try {
                const kbinfo: KeyboardInfo = {
                    rows: 0,
                    cols: 0,
                };
                await vialService.init(kbinfo);
                const loadedInfo = await vialService.load(kbinfo);

                // Load QMK settings
                console.log("[VialContext] About to load QMK settings...");
                try {
                    await qmkService.get(loadedInfo);
                    console.log("[VialContext] QMK settings loaded:", loadedInfo.settings);
                } catch (error) {
                    console.warn("Failed to load QMK settings:", error);
                }

                // Load layer colors from keyboard using VIA custom values
                console.log("[VialContext] Loading layer colors from keyboard...");
                try {
                    const layerColors = await usbInstance.getAllLayerColors();
                    // Convert to format with val (brightness) - default to max
                    loadedInfo.layer_colors = layerColors.map(c => ({
                        hue: c.hue,
                        sat: c.sat,
                        val: 255
                    }));
                    console.log("[VialContext] Layer colors loaded:", loadedInfo.layer_colors);

                    // Also update cosmetic.layer_colors with the closest preset color names
                    // This is needed for the keyboard display to show correct colors
                    if (!loadedInfo.cosmetic) {
                        loadedInfo.cosmetic = { layer: {}, layer_colors: {} };
                    }
                    if (!loadedInfo.cosmetic.layer_colors) {
                        loadedInfo.cosmetic.layer_colors = {};
                    }
                    layerColors.forEach((c, idx) => {
                        const presetName = getClosestPresetColor(c.hue, c.sat, 255);
                        loadedInfo.cosmetic!.layer_colors![idx.toString()] = presetName;
                    });
                    console.log("[VialContext] Cosmetic layer colors:", loadedInfo.cosmetic.layer_colors);
                } catch (error) {
                    console.warn("Failed to load layer colors:", error);
                }

                // Load all VIA3 custom values (DPI, scroll mode, automouse, etc.)
                if (loadedInfo.menus) {
                    console.log("[VialContext] Loading VIA3 custom values from keyboard...");
                    try {
                        // Drop any values cached from a previous connect so a stale
                        // reading can't survive a reconnect within the same page session.
                        customValueService.clearCache();
                        loadedInfo.custom_values = await customValueService.loadAllMenuValues(loadedInfo.menus);
                        console.log("[VialContext] Custom values loaded:", loadedInfo.custom_values.length, "entries");
                    } catch (error) {
                        console.warn("Failed to load custom values:", error);
                    }
                }

                setKeyboard(loadedInfo);
                // Store original state for revert functionality
                setOriginalKeyboard(JSON.parse(JSON.stringify(loadedInfo)));
                // Set loadedFrom to device product name
                const deviceName = usbInstance.getDeviceName();
                setLoadedFrom(deviceName || loadedInfo.kbid || "Connected Device");
            } catch (error) {
                if (error instanceof SvalPreviewRequiredError) {
                    setIsConnected(false);
                    setKeyboard(null);
                    setOriginalKeyboard(null);
                    keyboardRef.current = null;
                    setLoadedFrom(null);
                    setActiveLayerIndex(null);
                    let failedToRelease = false;
                    try {
                        await usbInstance.close();
                    } catch (closeError) {
                        failedToRelease = true;
                        console.warn("Could not release keyboard connection:", closeError);
                    }
                    setReleaseFailed(failedToRelease);
                    setCompatibilityNotice(true);
                    return;
                }
                console.error("Failed to load keyboard:", error);
                throw error;
            }
        })();
        inFlightLoadRef.current = loadPromise;
        // Handle both outcomes without creating an unhandled rejected promise.
        const clearLoad = () => { inFlightLoadRef.current = null; };
        loadPromise.then(clearLoad, clearLoad);
        return loadPromise;
    }, [isConnected]);

    useEffect(() => {
        if (isConnected) {
            loadKeyboard().catch((error) => {
                console.error("Failed to auto-load keyboard:", error);
                setIsConnected(false);
            });
        }
    }, [isConnected, loadKeyboard]);

    const loadFromFile = useCallback(async (file: File) => {
        try {
            const kbinfo = await fileService.loadFile(file);

            // .svil / .vil files only carry user-editable data (keymap,
            // macros, combos, etc.). Device-derived structural fields come
            // from the keyboard payload at connect time and are not in the
            // file format. If a board is currently connected, merge those
            // fields in so things like SV_* mouse keys (read from
            // custom_keycodes) keep showing up after a file load instead of
            // disappearing until the user reconnects.
            const deviceState = keyboardRef.current;
            if (deviceState) {
                if (deviceState.custom_keycodes) kbinfo.custom_keycodes = deviceState.custom_keycodes;
                if (deviceState.payload) kbinfo.payload = deviceState.payload;
                if (deviceState.name && !kbinfo.name) kbinfo.name = deviceState.name;
                if (deviceState.feature_flags !== undefined && kbinfo.feature_flags === undefined) {
                    kbinfo.feature_flags = deviceState.feature_flags;
                }
                if (deviceState.macros_size !== undefined && kbinfo.macros_size === undefined) {
                    kbinfo.macros_size = deviceState.macros_size;
                }
                if (!kbinfo.menus && deviceState.menus) kbinfo.menus = deviceState.menus;
                if (!kbinfo.fragments && deviceState.fragments) kbinfo.fragments = deviceState.fragments;
                if (!kbinfo.composition && deviceState.composition) kbinfo.composition = deviceState.composition;
                if (!kbinfo.keylayout && deviceState.keylayout) kbinfo.keylayout = deviceState.keylayout;
            }

            svalService.setupCosmeticLayerNames(kbinfo);
            keyService.generateAllKeycodes(kbinfo);
            setKeyboard(kbinfo);
            // Store original state for revert functionality
            setOriginalKeyboard(JSON.parse(JSON.stringify(kbinfo)));
            const filePath = file.name;
            setLoadedFrom(filePath);
            setIsConnected(false);
        } catch (error) {
            console.error("Failed to load file:", error);
            throw error;
        }
    }, []);

    // Note: Auto-restore from localStorage was removed to ensure users always
    // see the "Connect or Load a File" page on refresh. Users should explicitly
    // connect to a device or load a file each session.

    const updateKey = useCallback(
        async (layer: number, row: number, col: number, keymask: number) => {
            if (!isConnected) {
                throw new Error("USB device not connected");
            }
            await vialService.updateKey(layer, row, col, keymask);
        },
        [isConnected]
    );

    const pollMatrix = useCallback(async () => {
        if (!keyboard || !isConnected) return [];
        const result = await vialService.pollMatrix(keyboard);
        setLastHeartbeat(Date.now());
        return result;
    }, [keyboard, isConnected]);

    useEffect(() => {
        let isActive = true;
        let timeoutId: number | undefined;

        const pollLayerState = async () => {
            if (!isActive) return;
            if (isConnected && keyboard && usbInstance.getDeviceName()) {
                try {
                    const activeLayer = await vialService.getActiveLayerIndex();
                    if (isActive) {
                        setActiveLayerIndex(activeLayer);
                    }
                } catch (error) {
                    console.warn("Layer state polling error:", error);
                }
            } else if (isActive) {
                setActiveLayerIndex(null);
            }

            if (isActive) {
                timeoutId = window.setTimeout(pollLayerState, 120);
            }
        };

        pollLayerState();

        return () => {
            isActive = false;
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [isConnected, keyboard]);

    // Reset keyboard to original state (used by revert)
    const resetToOriginal = useCallback(() => {
        if (originalKeyboard) {
            setKeyboard(JSON.parse(JSON.stringify(originalKeyboard)));
        }
    }, [originalKeyboard]);

    // Mark current state as saved (called after push/commit)
    const markAsSaved = useCallback(() => {
        if (keyboard) {
            setOriginalKeyboard(JSON.parse(JSON.stringify(keyboard)));
        }
    }, [keyboard]);

    // Detect if there are unsaved changes by comparing current to original
    const hasUnsavedChanges = React.useMemo(() => {
        if (!keyboard || !originalKeyboard) return false;
        return JSON.stringify(keyboard) !== JSON.stringify(originalKeyboard);
    }, [keyboard, originalKeyboard]);

    const value: VialContextType = {
        keyboard,
        setKeyboard,
        originalKeyboard,
        resetToOriginal,
        markAsSaved,
        hasUnsavedChanges,
        isConnected,
        isWebHIDSupported,
        isImporting,
        setIsImporting,
        loadedFrom,
        connect,
        connectDevice,
        disconnect,
        loadKeyboard,
        loadFromFile,
        updateKey,
        pollMatrix,
        lastHeartbeat,
        activeLayerIndex,
    };

    return <VialContext.Provider value={value}>
        {compatibilityNotice ? (
            <SvalCompatibilityNotice releaseFailed={releaseFailed} onDisconnect={() => { void disconnect(); }} />
        ) : children}
    </VialContext.Provider>;
};

export const useVial = (): VialContextType => {
    const context = useContext(VialContext);
    if (!context) {
        throw new Error("useVial must be used within a VialProvider");
    }
    return context;
};
