import { useEffect, useState } from "react";
import { ReadStoredTheme, StoreTheme, SubscribeThemeChanged } from "../Lib/ThemeStore";
import type { Theme } from "../Lib/Themes";

/**
 * The saved theme choice - light, dark or following the device - and a setter that saves it.
 * Each host applies the choice by subscribing to the store at start-up.
 * @returns The current choice and a setter.
 */
export const useStoredTheme = () => {
    const [theme, setThemeState] = useState<Theme>(ReadStoredTheme);

    useEffect(() => SubscribeThemeChanged(setThemeState), []);

    return { theme, setTheme: StoreTheme };
};
