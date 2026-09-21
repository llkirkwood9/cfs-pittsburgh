import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "theme";

let listeners: ((theme: Theme) => void)[] = [];

/**
 * Reads the persisted theme preference.
 * @returns The stored theme, defaulting to "system".
 */
const readStoredTheme = (): Theme => {
    const stored = localStorage.getItem(STORAGE_KEY);
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
const applyTheme = (theme: Theme): void => {
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

applyTheme(readStoredTheme());

/**
 * Tri-state theme hook. Persists to localStorage and follows the OS while set to "system".
 * @returns The current preference and a setter.
 */
export const useTheme = () => {
    const [theme, setThemeState] = useState<Theme>(readStoredTheme);

    useEffect(() => {
        applyTheme(theme);

        const media = window.matchMedia("(prefers-color-scheme: dark)");
        const onSystemChange = () => {
            if (theme === "system") applyTheme("system");
        };

        media.addEventListener("change", onSystemChange);
        return () => media.removeEventListener("change", onSystemChange);
    }, [theme]);

    useEffect(() => subscribeThemeChanged(setThemeState), []);

    const setTheme = (next: Theme) => {
        localStorage.setItem(STORAGE_KEY, next);
        applyTheme(next);
        setThemeState(next);
        listeners.forEach((listener) => listener(next));
    };

    return { theme, setTheme };
};
