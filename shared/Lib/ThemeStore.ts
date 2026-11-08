import { DeviceStorage } from "@host";
import { SharedStorageKeys } from "./StorageKeys";
import type { Theme } from "./Themes";

let listeners: ((theme: Theme) => void)[] = [];

/**
 * Reads the saved theme choice.
 * @returns The saved choice, defaulting to "system".
 */
export const ReadStoredTheme = (): Theme => {
    const stored = DeviceStorage.get(SharedStorageKeys.theme);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
};

/**
 * Saves a new theme choice and tells everyone listening, which is how the host applies it.
 * @param next The choice.
 */
export const StoreTheme = (next: Theme): void => {
    DeviceStorage.set(SharedStorageKeys.theme, next);
    listeners.forEach((listener) => listener(next));
};

/**
 * Subscribes to theme changes, inside React or out.
 * @param listener Called with the new choice.
 * @returns An unsubscribe function.
 */
export const SubscribeThemeChanged = (listener: (theme: Theme) => void): (() => void) => {
    listeners.push(listener);
    return () => {
        listeners = listeners.filter((l) => l !== listener);
    };
};
