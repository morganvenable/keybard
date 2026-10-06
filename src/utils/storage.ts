import { appStorage } from "@/utils/app-storage";
import { KeyboardInfo } from "@/types/keyboard.types";

const STORAGE_KEY = "keybard_last_file_path";

export const storage = {
    getLastFilePath(): string | null {
        try {
            return appStorage.getItem(STORAGE_KEY);
        } catch {
            return null;
        }
    },

    setLastFilePath(path: string): void {
        try {
            appStorage.setItem(STORAGE_KEY, path);
        } catch (error) {
            console.warn("Failed to save file path:", error);
        }
    },

    clearLastFilePath(): void {
        try {
            appStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            console.warn("Failed to clear file path:", error);
        }
    },

    async saveFile(keyboardInfo: KeyboardInfo): Promise<void> {
        try {
            const content = JSON.stringify(keyboardInfo, null, 2);
            appStorage.setItem("keybard_saved_file", content);
        } catch (error) {
            console.warn("Failed to save file:", error);
        }
    },
};
