import type { Theme } from "@shared/Lib/Themes";

export type { Theme };

export const THEME_STORAGE_KEY = "theme";

let listeners: ((theme: Theme) => void)[] = [];

/**
 * Reads the persisted theme preference.
 * @returns The stored theme, defaulting to "system".
 */
export const readStoredTheme = (): Theme => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
};

/**
 * Resolves whether the dark class should be on the document right now.
 * @param theme The preference to resolve.
 * @returns True when dark styling applies.
 */
const resolveIsDark = (theme: Theme): boolean =>
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

/**
 * Applies the theme to the document element.
 * @param theme The preference to apply.
 */
export const applyTheme = (theme: Theme): void => {
    document.documentElement.classList.toggle("dark", resolveIsDark(theme));
};

/**
 * Reads the current effective theme synchronously, for non-component code such as Toast.
 * @returns "dark" or "light".
 */
export const getCurrentTheme = (): "dark" | "light" =>
    resolveIsDark(readStoredTheme()) ? "dark" : "light";

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
 * Stores a new preference, applies it and tells every useTheme.
 * @param next The preference.
 */
export const storeTheme = (next: Theme): void => {
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
    listeners.forEach((listener) => listener(next));
};
