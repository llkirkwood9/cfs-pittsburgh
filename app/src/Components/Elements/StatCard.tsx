import type { ReactNode } from "react";
import { View } from "react-native";
import Icon from "./Icon";
import Text from "./Text";
import { cx } from "../../Lib/ClassNames";

type Props = {
    label: string;
    value: string | number;
    sublabel?: string;
    icon?: string;
    accent?: "sky" | "green" | "amber" | "zinc" | "violet";
    /** Shown at the right of the label row, e.g. milestone stars. */
    badge?: ReactNode;
    className?: string;
};

const accents: Record<string, string> = {
    sky: "text-sky-700 dark:text-sky-400",
    green: "text-green-700 dark:text-green-400",
    amber: "text-amber-700 dark:text-amber-400",
    violet: "text-violet-700 dark:text-violet-400",
    zinc: "text-zinc-700 dark:text-zinc-300",
};

/**
 * One box of the stat sheet. Value is set large so a manager can read the day's numbers from
 * across the table.
 */
const StatCard = ({
    label,
    value,
    sublabel,
    icon,
    accent = "zinc",
    badge,
    className = "",
}: Props) => {
    return (
        <View className={cx("rounded-xl bg-white p-4 raised-sm dark:bg-zinc-800", className)}>
            <View className="flex-row items-center gap-2">
                {icon && <Icon icon={icon} className={`text-sm ${accents[accent]}`} />}
                <Text
                    className="shrink text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                    numberOfLines={1}
                >
                    {label}
                </Text>
                {badge && <View className="ml-auto">{badge}</View>}
            </View>
            <Text className={`mt-1 text-2xl font-bold tabular-nums ${accents[accent]}`}>
                {value}
            </Text>
            {sublabel && (
                <Text className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{sublabel}</Text>
            )}
        </View>
    );
};

export default StatCard;
