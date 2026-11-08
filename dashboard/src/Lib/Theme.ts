import { ReadStoredTheme, SubscribeThemeChanged } from "@shared/Lib/ThemeStore";
import type { Theme } from "@shared/Lib/Themes";

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
 * Applies the saved choice before the first paint, and again whenever it changes or, while it
 * follows the device, whenever the device switches.
 */
export const StartTheme = (): void => {
    applyTheme(ReadStoredTheme());
    SubscribeThemeChanged(applyTheme);
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        if (ReadStoredTheme() === "system") applyTheme("system");
    });
};

/**
 * Reads the current effective theme synchronously, for non-component code such as Toast.
 * @returns "dark" or "light".
 */
export const getCurrentTheme = (): "dark" | "light" =>
    resolveIsDark(ReadStoredTheme()) ? "dark" : "light";
