import { Pressable } from "react-native";
import Icon from "../Elements/Icon";
import { useTheme } from "../../Hooks/UseTheme";
import { NextTheme, ThemeIcon } from "@shared/Lib/Themes";


/**
 * Cycles light, dark and system. Dark is the default many crews want under gym lighting.
 */
const ThemeToggle = () => {
    const { theme, setTheme } = useTheme();

    const cycle = () => setTheme(NextTheme(theme));

    return (
        <Pressable
            onPress={cycle}
            accessibilityRole="button"
            accessibilityLabel={`Theme: ${theme}`}
            className="h-11 w-11 items-center justify-center rounded-xl active:bg-white/10"
        >
            <Icon icon={ThemeIcon(theme)} className="text-lg text-zinc-200" />
        </Pressable>
    );
};

export default ThemeToggle;
