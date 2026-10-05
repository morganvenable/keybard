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
    markAsSaved: (confirmed?: KeyboardInfo | null) => void;
    getKeyboardSnapshot: () => KeyboardInfo | null;
    connectionSessionId: number;
    connectionState: "idle" | "connecting" | "loading" | "connected" | "offline" | "error";
    connectionError: string | null;
    isChangingTarget: boolean;
    runDeviceMaintenance: <T>(operation: () => Promise<T>) => Promise<T>;
    registerTargetChangeGuard: (guard: () => Promise<(discardPending?: boolean) => void>) => () => void;
    hasUnsavedChanges: boolean;
    isConnected: boolean;
    isWebHIDSupported: boolean;
    isImporting: boolean;
    setIsImporting: React.Dispatch<React.SetStateAction<boolean>>;
    loadedFrom: string | null;
    connect: (filters?: HIDDeviceFilter[]) => Promise<boolean>;
    /** Open an already-permitted device (from listPermittedDevices) without the chooser. */
    connectDevice: (device: HIDDevice) => Promise<boolean>;
    disconnect: () => Promise<void>;
    loadKeyboard: () => Promise<void>;
    loadFromFile: (file: File, source?: "file" | "demo") => Promise<boolean>;
    updateKey: (layer: number, row: number, col: number, keymask: number) => Promise<void>;
    pollMatrix: () => Promise<boolean[][]>;
    lastHeartbeat: number;
    activeLayerIndex: number | null;
}

const serializeDraft = (value: unknown) => JSON.stringify(value, (_key, item) => item instanceof Map ? { __map: [...item.entries()] } : item);

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
export async function listPermittedDevices(filters: HIDDeviceFilter[] = DEFAULT_HID_FILTERS): Promise<HIDDevice[]> {
    if (typeof navigator === "undefined" || !navigator.hid?.getDevices) return [];
    const devices = await navigator.hid.getDevices();
    const matches = (d: HIDDevice) => d.collections.some((c) => filters.some((f) =>
        (f.vendorId === undefined || d.vendorId === f.vendorId) &&
        (f.productId === undefined || d.productId === f.productId) &&
        (f.usagePage === undefined || c.usagePage === f.usagePage) &&
        (f.usage === undefined || c.usage === f.usage)));
    return devices.filter(matches);
}

export const VialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [keyboard, setKeyboardState] = useState<KeyboardInfo | null>(null);
    const [originalKeyboard, setOriginalKeyboard] = useState<KeyboardInfo | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionState, setConnectionState] = useState<VialContextType["connectionState"]>("idle");
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [connectionSessionId, setConnectionSessionId] = useState(0);
    const sessionRef = useRef(0);
    const targetChangeGuard = useRef<(() => Promise<(discardPending?: boolean) => void>) | null>(null);
    const targetChanging = useRef(false);
    const [isChangingTarget, setIsChangingTarget] = useState(false);
    const registerTargetChangeGuard = useCallback((guard: () => Promise<(discardPending?: boolean) => void>) => {
        targetChangeGuard.current = guard;
        return () => { if (targetChangeGuard.current === guard) targetChangeGuard.current = null; };
    }, []);
    const beginTargetChange = useCallback(async () => {
        if (targetChanging.current) throw new Error("Another connection change is still in progress.");
        targetChanging.current = true;
        setIsChangingTarget(true);
        try {
            const release = await targetChangeGuard.current?.();
            // Finish protocol reads on the old transport before another device can open.
            await inFlightLoadRef.current?.catch(() => undefined);
            return (discardPending = false) => { release?.(discardPending); targetChanging.current = false; setIsChangingTarget(false); };
        } catch (error) { targetChanging.current = false; setIsChangingTarget(false); throw error; }
    }, []);
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

    const keyboardRef = useRef<KeyboardInfo | null>(null);
    const setKeyboard = useCallback<React.Dispatch<React.SetStateAction<KeyboardInfo | null>>>((update) => {
        const next = typeof update === "function" ? update(keyboardRef.current) : update;
        keyboardRef.current = next;
        setKeyboardState(next);
    }, []);
    const originalRef = useRef(originalKeyboard);
    originalRef.current = originalKeyboard;
    const confirmTargetChange = useCallback(() => {
        const dirty = keyboardRef.current && originalRef.current &&
            serializeDraft(keyboardRef.current) !== serializeDraft(originalRef.current);
        return !dirty || window.confirm("You have unsaved edits. Discard them and change the editing target?");
    }, []);
    const nextSession = useCallback(() => {
        sessionRef.current += 1;
        setConnectionSessionId(sessionRef.current);
    }, []);

    const afterOpen = useCallback((success: boolean) => {
        if (success) {
            nextSession();
            setKeyboard(null);
            setOriginalKeyboard(null);
            setConnectionState("loading");
            usbInstance.onDisconnect = () => {
                console.log("Disconnect detected via listener");
                sessionRef.current += 1; // invalidate an interrupted load, retain the draft and queue
                setIsConnected(false);
                setConnectionState("offline");
                setConnectionError("Keyboard disconnected. Your local edits are retained; export a backup before reconnecting if needed.");
            };
        }
        setIsConnected(success);
        if (!success) setConnectionState(keyboardRef.current ? "offline" : "idle");
        return success;
    }, [nextSession]);

    const connect = useCallback(async (filters?: HIDDeviceFilter[]) => {
        if (!confirmTargetChange()) return false;
        setConnectionError(null);
        setConnectionState("connecting");
        let release: ((discardPending?: boolean) => void) | undefined;
        let changed = false;
        try {
            release = await beginTargetChange();
            changed = await usbInstance.open(filters || DEFAULT_HID_FILTERS);
            return afterOpen(changed);
        } catch (error) {
            console.error("Failed to connect to keyboard:", error);
            const failure = error instanceof Error ? error : new Error(String(error));
            setConnectionError(failure.message);
            setConnectionState("error");
            return false;
        } finally { release?.(changed); }
    }, [afterOpen, confirmTargetChange, beginTargetChange]);

    const connectDevice = useCallback(async (device: HIDDevice) => {
        if (!confirmTargetChange()) return false;
        setConnectionError(null);
        setConnectionState("connecting");
        let release: ((discardPending?: boolean) => void) | undefined;
        let changed = false;
        try {
            release = await beginTargetChange();
            changed = await usbInstance.openDevice(device);
            return afterOpen(changed);
        } catch (error) {
            console.error("Failed to open permitted keyboard:", error);
            const failure = error instanceof Error ? error : new Error(String(error));
            setConnectionError(failure.message);
            setConnectionState("error");
            return false;
        } finally { release?.(changed); }
    }, [afterOpen, confirmTargetChange, beginTargetChange]);

    const disconnect = useCallback(async () => {
        const release = await beginTargetChange();
        try {
            await usbInstance.close();
            setIsConnected(false);
            sessionRef.current += 1;
            setConnectionState(keyboardRef.current ? "offline" : "idle");
        } catch (error) {
            setConnectionError(error instanceof Error ? error.message : String(error));
            throw error;
        } finally { release(); }
    }, [beginTargetChange]);

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

        const session = sessionRef.current;
        setConnectionState("loading");
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

                if (session !== sessionRef.current) return;
                setKeyboard(loadedInfo);
                setConnectionState("connected");
                setConnectionError(null);
                // Store original state for revert functionality
                setOriginalKeyboard(structuredClone(loadedInfo));
                // Set loadedFrom to device product name
                const deviceName = usbInstance.getDeviceName();
                setLoadedFrom(deviceName || loadedInfo.kbid || "Connected Device");
            } catch (error) {
                if (session === sessionRef.current) {
                    setConnectionError(error instanceof Error ? error.message : String(error));
                    setConnectionState("error");
                    try { await usbInstance.close(); } catch (closeError) { console.error("Failed to close connection after load error", closeError); }
                }
                throw error;
            }
        })();
        inFlightLoadRef.current = loadPromise;
        const clearLoad = () => {
            if (inFlightLoadRef.current === loadPromise) inFlightLoadRef.current = null;
        };
        void loadPromise.then(clearLoad, clearLoad);
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

    const loadFromFile = useCallback(async (file: File, source: "file" | "demo" = "file") => {
        let release: ((discardPending?: boolean) => void) | undefined;
        let changed = false;
        try {
            const kbinfo = await fileService.loadFile(file);

            // Offline files own their metadata. Never borrow capabilities or layout
            // structure from a previously connected, possibly unrelated board.
            if (!confirmTargetChange()) return false;
            release = await beginTargetChange();
            svalService.setupCosmeticLayerNames(kbinfo);
            keyService.generateAllKeycodes(kbinfo);
            if (VialService.isWebHIDSupported()) await usbInstance.close();
            nextSession();
            changed = true;
            setConnectionError(null);
            setConnectionState("offline");
            setKeyboard(kbinfo);
            // Store original state for revert functionality
            setOriginalKeyboard(structuredClone(kbinfo));
            const filePath = source === "demo" ? "QWERTY example (demo)" : file.name;
            setLoadedFrom(filePath);
            setIsConnected(false);
            return true;
        } catch (error) {
            throw error instanceof Error ? error : new Error(String(error));
        } finally { release?.(changed); }
    }, [confirmTargetChange, nextSession, beginTargetChange]);

    const runDeviceMaintenance = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
        if (!isConnected || connectionState !== "connected") throw new Error("Connect a keyboard before performing maintenance.");
        const session = sessionRef.current;
        const release = await beginTargetChange();
        try {
            if (session !== sessionRef.current) throw new Error("The keyboard disconnected before maintenance could start.");
            return await operation();
        } finally { release(); }
    }, [isConnected, connectionState, beginTargetChange]);

    // Note: Auto-restore from localStorage was removed to ensure users always
    // see the "Connect or Load a File" page on refresh. Users should explicitly
    // connect to a device or load a file each session.

    const updateKey = useCallback(
        async (layer: number, row: number, col: number, keymask: number) => {
            if (!isConnected || connectionState !== "connected") {
                throw new Error("Keyboard is not ready for changes");
            }
            await vialService.updateKey(layer, row, col, keymask);
        },
        [isConnected, connectionState]
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
            setKeyboard(structuredClone(originalKeyboard));
        }
    }, [originalKeyboard]);

    // Mark current state as saved (called after push/commit)
    const getKeyboardSnapshot = useCallback(() => keyboardRef.current ? structuredClone(keyboardRef.current) : null, []);
    const markAsSaved = useCallback((confirmed?: KeyboardInfo | null) => {
        if (confirmed) setOriginalKeyboard(structuredClone(confirmed));
    }, []);

    // Detect if there are unsaved changes by comparing current to original
    const hasUnsavedChanges = React.useMemo(() => {
        if (!keyboard || !originalKeyboard) return false;
        return serializeDraft(keyboard) !== serializeDraft(originalKeyboard);
    }, [keyboard, originalKeyboard]);

    useEffect(() => {
        if (!hasUnsavedChanges) return;
        const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [hasUnsavedChanges]);

    const value: VialContextType = {
        keyboard,
        setKeyboard,
        originalKeyboard,
        resetToOriginal,
        markAsSaved,
        getKeyboardSnapshot,
        connectionState,
        connectionError,
        connectionSessionId,
        registerTargetChangeGuard,
        isChangingTarget,
        runDeviceMaintenance,
        hasUnsavedChanges,
        isConnected: isConnected && connectionState === "connected",
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

    return <VialContext.Provider value={value}>{children}</VialContext.Provider>;
};

export const useVial = (): VialContextType => {
    const context = useContext(VialContext);
    if (!context) {
        throw new Error("useVial must be used within a VialProvider");
    }
    return context;
};
