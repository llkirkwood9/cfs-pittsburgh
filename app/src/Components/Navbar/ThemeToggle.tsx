import { Pressable } from "react-native";
import Icon from "../Elements/Icon";
import { useTheme } from "../../Hooks/UseTheme";
import type { Theme } from "../../Hooks/UseTheme";

const order: Theme[] = ["light", "dark", "system"];
const icons: Record<Theme, string> = {
    light: "fa-solid fa-sun",
    dark: "fa-solid fa-moon",
    system: "fa-solid fa-circle-half-stroke",
};

/**
 * Cycles light, dark and system. Dark is the default many crews want under gym lighting.
 */
const ThemeToggle = () => {
    const { theme, setTheme } = useTheme();

    const cycle = () => setTheme(order[(order.indexOf(theme) + 1) % order.length]);

    return (
        <Pressable
            onPress={cycle}
            accessibilityRole="button"
            accessibilityLabel={`Theme: ${theme}`}
            className="h-11 w-11 items-center justify-center rounded-xl active:bg-white/10"
        >
            <Icon icon={icons[theme]} className="text-lg text-zinc-200" />
        </Pressable>
    );
};

export default ThemeToggle;
