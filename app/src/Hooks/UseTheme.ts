import { colorScheme, useColorScheme } from "nativewind";
import { useEffect, useState } from "react";
import { GetItem, SetItem } from "../Lib/Storage";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "theme";

let listeners: ((theme: Theme) => void)[] = [];

/**
 * Reads the persisted theme preference.
 * @returns The stored theme, defaulting to "system".
 */
const readStoredTheme = (): Theme => {
    const stored = GetItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
};

/**
 * Applies the stored preference. Called once at start-up, after storage has loaded. NativeWind
 * also sets the native appearance, so switches, alerts and the status bar follow it.
 */
export const ApplyStoredTheme = (): void => {
    colorScheme.set(readStoredTheme());
};

/**
 * Subscribes to theme changes from outside React.
 * @param listener Called with the new preference.
 * @returns An unsubscribe function.
 */
export const subscribeThemeChanged = (listener: (theme: Theme) => void): (() => void) => {
    listeners.push(listener);
    return () => {
        listeners = listeners.filter((l) => l !== listener);
    };
};

/**
 * Tri-state theme hook. Persists to the device and follows the OS while set to "system".
 * @returns The current preference, whether dark styling applies now, and a setter.
 */
export const useTheme = () => {
    const [theme, setThemeState] = useState<Theme>(readStoredTheme);
    const { colorScheme: resolved } = useColorScheme();

    useEffect(() => subscribeThemeChanged(setThemeState), []);

    const setTheme = (next: Theme) => {
        SetItem(STORAGE_KEY, next);
        colorScheme.set(next);
        setThemeState(next);
        listeners.forEach((listener) => listener(next));
    };

    return { theme, isDark: resolved === "dark", setTheme };
};
