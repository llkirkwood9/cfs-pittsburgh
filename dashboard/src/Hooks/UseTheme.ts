import { useEffect, useState } from "react";
import { applyTheme, readStoredTheme, storeTheme, subscribeThemeChanged } from "../Lib/Theme";
import type { Theme } from "../Lib/Theme";

export type { Theme };

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
        storeTheme(next);
        setThemeState(next);
    };

    return { theme, setTheme };
};
