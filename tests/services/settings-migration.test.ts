import { describe, expect, it } from "vitest";
import { DEAD_V1_SETTINGS, migrateSettings, SETTINGS_SCHEMA_VERSION } from "../../src/services/settings-migration";

const v1 = {
    theme: "dark",
    "live-updating": false,
    "typing-binds-key": true,
    "serial-assignment": "svalboard",
    "international-keyboards": "german-qwertz",
    "left-dpi": 1200,
    "right-dpi": 800,
    "scroll-left": true,
    "scroll-right": false,
    "auto-mouse": true,
    "auto-mouse-timeout": 700,
    // Keys from another branch (combo-review) that this build doesn't define.
    "combo-indicators": "small",
    "show-alt-repeat": true,
};

describe("settings migration", () => {
    it("takes v1 to v2: drops the dead pointing keys and keeps everything else", () => {
        const migrated = migrateSettings(v1);
        expect(migrated.__v).toBe(SETTINGS_SCHEMA_VERSION);
        for (const key of DEAD_V1_SETTINGS) expect(migrated).not.toHaveProperty(key);
        expect(migrated).toMatchObject({
            theme: "dark",
            "live-updating": false,
            "typing-binds-key": true,
            "serial-assignment": "svalboard",
            "international-keyboards": "german-qwertz",
            "combo-indicators": "small",
            "show-alt-repeat": true,
        });
        expect(Object.keys(migrated)).toHaveLength(Object.keys(v1).length - DEAD_V1_SETTINGS.length + 1);
    });

    it("leaves a v2 object unchanged, so running it again does nothing", () => {
        const once = migrateSettings(v1);
        expect(migrateSettings(once)).toEqual(once);
        expect(migrateSettings(migrateSettings(once))).toEqual(once);
    });

    it("keeps a v2 key that shares a dead v1 name, since v2 never strips it", () => {
        const v2 = { __v: 2, "left-dpi": 900 };
        expect(migrateSettings(v2)).toEqual({ ...v2, __v: SETTINGS_SCHEMA_VERSION });
    });

    it("does not downgrade an object from a newer build", () => {
        expect(migrateSettings({ __v: 99, theme: "light" })).toEqual({ __v: 99, theme: "light" });
    });

    it.each([null, undefined, 42, "settings", [1, 2], true])("turns %j into the defaults", (garbage) => {
        expect(migrateSettings(garbage)).toEqual({ __v: SETTINGS_SCHEMA_VERSION });
    });

    it("drops values that aren't strings, numbers or booleans", () => {
        expect(migrateSettings({ theme: "dark", nested: { a: 1 }, list: [1], nan: Number.NaN, none: null }))
            .toEqual({ __v: SETTINGS_SCHEMA_VERSION, theme: "dark" });
    });

    it("treats a bad version as v1", () => {
        expect(migrateSettings({ __v: "two", "left-dpi": 1 })).toEqual({ __v: SETTINGS_SCHEMA_VERSION });
    });
});

describe("Key legends: Automatic (v3)", () => {
    it("moves anyone still on the old default, English (US), to Automatic", () => {
        expect(migrateSettings({ __v: 2, "international-keyboards": "us" })["international-keyboards"]).toBe("auto");
        expect(migrateSettings({ "international-keyboards": "us" })["international-keyboards"]).toBe("auto");
    });

    it("keeps any other layout someone picked, and older names of them", () => {
        for (const layout of ["german", "uk", "french", "japanese", "german-qwertz"])
            expect(migrateSettings({ __v: 2, "international-keyboards": layout })["international-keyboards"]).toBe(layout);
    });

    it("stores nothing when nothing was stored: the default is Automatic", () => {
        expect(migrateSettings({ __v: 2, theme: "dark" })).not.toHaveProperty("international-keyboards");
    });

    it("runs once: US chosen after the update stays US", () => {
        const after = { __v: SETTINGS_SCHEMA_VERSION, "international-keyboards": "us" };
        expect(migrateSettings(after)["international-keyboards"]).toBe("us");
    });
});

describe("settings migration on load", () => {
    it("migrates the stored object once, when the provider loads it", async () => {
        const { render, waitFor } = await import("@testing-library/react");
        const { createElement } = await import("react");
        const { appStorage } = await import("../../src/utils/app-storage");
        const { SettingsProvider } = await import("../../src/contexts/SettingsContext");
        appStorage.setItem("keyboard-settings", JSON.stringify(v1));
        render(createElement(SettingsProvider, null, null));
        await waitFor(() => expect(JSON.parse(appStorage.getItem("keyboard-settings")!).__v).toBe(SETTINGS_SCHEMA_VERSION));
        const stored = JSON.parse(appStorage.getItem("keyboard-settings")!);
        expect(stored).not.toHaveProperty("left-dpi");
        // The old select value becomes the switch: "small" is on.
        expect(stored["combo-indicators"]).toBe(true);
        appStorage.removeItem("keyboard-settings");
    });
});
