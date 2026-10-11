import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import type { ReactNode } from "react";
import { Platform, View } from "react-native";
import { cx } from "../../Lib/ClassNames";

type Props = {
    children: ReactNode;
    className?: string;
    /** The background used where Liquid Glass isn't available (Android, iOS before 26). */
    fallbackClassName?: string;
    interactive?: boolean;
};

/** Whether this device draws Liquid Glass. Read once: it can't change while the app runs. */
const GLASS =
    Platform.OS === "ios" && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

/**
 * A panel that floats over the screen - the order totals bar, a toolbar. On iOS 26 and later it is
 * Liquid Glass, like the tab bar under it; everywhere else it's the dashboard's solid card.
 */
const GlassPanel = ({
    children,
    className = "",
    fallbackClassName = "bg-white dark:bg-zinc-800",
    interactive = false,
}: Props) => {
    if (GLASS) {
        return (
            <GlassView
                glassEffectStyle="regular"
                isInteractive={interactive}
                className={cx("overflow-hidden", className)}
            >
                {children}
            </GlassView>
        );
    }
    return <View className={cx(fallbackClassName, className)}>{children}</View>;
};

export const HasLiquidGlass = GLASS;

export default GlassPanel;
