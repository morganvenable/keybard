import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { VialService, vialService } from "../services/vial.service";
import { svalService } from "../services/sval.service";

import { fileService } from "../services/file.service";
import { keyService } from "../services/key.service";
import { qmkService } from "../services/qmk.service";
import { usbInstance } from "../services/usb.service";
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
    loadedFrom: string | null;
    connect: (filters?: HIDDeviceFilter[]) => Promise<boolean>;
    disconnect: () => Promise<void>;
    loadKeyboard: () => Promise<void>;
    loadFromFile: (file: File) => Promise<void>;
    updateKey: (layer: number, row: number, col: number, keymask: number) => Promise<void>;
    pollMatrix: () => Promise<boolean[][]>;
    lastHeartbeat: number;
}

const VialContext = createContext<VialContextType | undefined>(undefined);

export const VialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [keyboard, setKeyboard] = useState<KeyboardInfo | null>(null);
    const [originalKeyboard, setOriginalKeyboard] = useState<KeyboardInfo | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [loadedFrom, setLoadedFrom] = useState<string | null>(null);
    const [lastHeartbeat, setLastHeartbeat] = useState<number>(0);
    const isWebHIDSupported = VialService.isWebHIDSupported();
    useEffect(() => {
        console.log("keyboard changed", keyboard);
    }, [keyboard]);

    const connect = useCallback(async (filters?: HIDDeviceFilter[]) => {
        try {
            const defaultFilters = [
                { usagePage: 0xff61, usage: 0x62 },  // Viable keyboards
                { usagePage: 0xff60, usage: 0x61 },  // Vial keyboards (legacy)
                { usagePage: 0xff60, usage: 0x62 },  // Vial RawHID (legacy)
            ];
            const success = await usbInstance.open(filters || defaultFilters);
            if (success) {
                usbInstance.onDisconnect = () => {
                    console.log("Disconnect detected via listener");
                    setIsConnected(false);
                };
            }
            setIsConnected(success);
            console.log("connected success:", success);
            return success;
        } catch (error) {
            console.error("Failed to connect to keyboard:", error);
            return false;
        }
    }, []);

    const disconnect = useCallback(async () => {
        try {
            await usbInstance.close();
            setIsConnected(false);
            setLoadedFrom(null);
        } catch (error) {
            console.error("Failed to disconnect:", error);
        }
    }, []);

    const loadKeyboard = useCallback(async () => {
        if (!isConnected) {
            console.log("loadKeyboard not connected");
            throw new Error("USB device not connected");
        }

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

            setKeyboard(loadedInfo);
            // Store original state for revert functionality
            setOriginalKeyboard(JSON.parse(JSON.stringify(loadedInfo)));
            // Set loadedFrom to device product name
            const deviceName = usbInstance.getDeviceName();
            setLoadedFrom(deviceName || loadedInfo.kbid || "Connected Device");
        } catch (error) {
            console.error("Failed to load keyboard:", error);
            throw error;
        }
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
        loadedFrom,
        connect,
        disconnect,
        loadKeyboard,
        loadFromFile,
        updateKey,
        pollMatrix,
        lastHeartbeat,
    };

    return <VialContext.Provider value={value}>{children}</VialContext.Provider>;
};

export const useVial = (): VialContextType => {
    const context = useContext(VialContext);
    if (!context) {
        throw new Error("useVial must be used within a VialProvider");
    }
    return context;
};
