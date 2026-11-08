import { colorScheme, useColorScheme } from "nativewind";
import { useStoredTheme } from "@shared/Hooks/useStoredTheme";
import { ReadStoredTheme, SubscribeThemeChanged } from "@shared/Lib/ThemeStore";

/**
 * Applies the saved choice, and again whenever it changes. Called once at start-up, after storage
 * has loaded. NativeWind also sets the native appearance, so switches, alerts and the status bar
 * follow it.
 */
export const ApplyStoredTheme = (): void => {
    colorScheme.set(ReadStoredTheme());
    SubscribeThemeChanged((theme) => colorScheme.set(theme));
};

/**
 * Tri-state theme hook. Persists to the device and follows the OS while set to "system".
 * @returns The current preference, whether dark styling applies now, and a setter.
 */
export const useTheme = () => {
    const { theme, setTheme } = useStoredTheme();
    const { colorScheme: resolved } = useColorScheme();
    return { theme, isDark: resolved === "dark", setTheme };
};
