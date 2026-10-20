import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { cssInterop } from "nativewind";
import { useEffect } from "react";
import Animated, {
    Easing,
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";
import { cx, HasTextColor } from "../../Lib/ClassNames";

// Lets NativeWind's text-* classes set the icon's colour, as they do on the dashboard. The size is
// read from the classes below, which works the same on every platform.
cssInterop(FontAwesome6, {
    className: {
        target: "style",
        nativeStyleToProp: { color: true },
    },
});

/** Tailwind's text sizes, in points, so an icon's text-* class sets its size on every platform. */
const SIZES: Record<string, number> = {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    "2xl": 24,
    "3xl": 30,
    "4xl": 36,
    "5xl": 48,
};

/**
 * The icon's size from its classes: text-lg, or an exact text-[11px].
 * @param className The icon's classes.
 * @returns The size in points; 16 when none is given.
 */
const SizeFor = (className: string): number => {
    const exact = /(?:^|\s)text-\[(\d+)px\]/.exec(className);
    if (exact) return Number(exact[1]);
    const named = /(?:^|\s)text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl)(?:\s|$)/.exec(className);
    return named ? SIZES[named[1]] : 16;
};

type Props = {
    /** The dashboard's FontAwesome name, e.g. "fa-solid fa-cart-plus". */
    icon: string;
    className?: string;
    spin?: boolean;
};

/**
 * The same FontAwesome 6 solid icons as the dashboard, named the same way, so a screen can be
 * copied across without renaming a single icon.
 */
const Icon = ({ icon, className = "", spin = false }: Props) => {
    const name = icon.replace(/fa-(solid|regular|brands)\s*/g, "").replace(/^fa-/, "").trim();
    // The outline set where the dashboard asks for it (fa-regular fa-circle), solid otherwise.
    const regular = icon.includes("fa-regular");
    const turn = useSharedValue(0);

    useEffect(() => {
        if (!spin) return;
        turn.value = withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1);
        return () => cancelAnimation(turn);
    }, [spin, turn]);

    const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));

    const glyph = (
        <FontAwesome6
            name={name}
            solid={!regular}
            regular={regular}
            size={SizeFor(className)}
            className={cx(
                !HasTextColor(className) && "text-zinc-700 dark:text-zinc-200",
                className
            )}
        />
    );

    return spin ? <Animated.View style={spinStyle}>{glyph}</Animated.View> : glyph;
};

export default Icon;
