import Icon from "../Elements/Icon";
import { useStoredTheme } from "@shared/Hooks/useStoredTheme";
import { NextTheme, ThemeIcon } from "@shared/Lib/Themes";

/**
 * Cycles light, dark and system. Dark is the default many crews want under gym lighting.
 */
const ThemeToggle = () => {
    const { theme, setTheme } = useStoredTheme();

    const cycle = () => setTheme(NextTheme(theme));

    return (
        <button
            type="button"
            onClick={cycle}
            title={`Theme: ${theme}`}
            aria-label={`Theme: ${theme}`}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-zinc-200 hover:bg-white/10"
        >
            <Icon icon={ThemeIcon(theme)} className="text-lg" />
        </button>
    );
};

export default ThemeToggle;
