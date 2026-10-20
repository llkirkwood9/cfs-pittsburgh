import { Pressable, View } from "react-native";
import Text from "./Text";
import { cx } from "../../Lib/ClassNames";

type Props = {
    text: string;
    active: boolean;
    onClick: () => void;
    badge?: number;
    /** A short word shown in a small pill after the text, e.g. "Past". */
    tag?: string;
    className?: string;
};

/**
 * Segmented-control style tab, used for the draft switcher and the catalog category filter.
 */
const TabButton = ({ text, active, onClick, badge, tag, className = "" }: Props) => {
    return (
        <Pressable
            onPress={onClick}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className={cx(
                "min-h-[44px] shrink-0 flex-row items-center gap-2 rounded-xl px-4",
                active
                    ? "bg-sky-700 dark:bg-sky-600"
                    : "bg-zinc-200 active:bg-zinc-300 dark:bg-zinc-700",
                className
            )}
        >
            <Text
                className={cx(
                    "text-sm font-semibold",
                    active ? "text-white" : "text-zinc-700 dark:text-zinc-200"
                )}
            >
                {text}
            </Text>
            {tag && (
                <View
                    className={cx(
                        "rounded-full px-1.5 py-0.5",
                        active ? "bg-white/25" : "bg-zinc-300 dark:bg-zinc-600"
                    )}
                >
                    <Text
                        className={cx(
                            "text-[10px] font-bold uppercase tracking-wide",
                            active ? "text-white" : "text-zinc-600 dark:text-zinc-300"
                        )}
                    >
                        {tag}
                    </Text>
                </View>
            )}
            {badge !== undefined && badge > 0 && (
                <View
                    className={cx(
                        "rounded-full px-2 py-0.5",
                        active ? "bg-white/25" : "bg-zinc-300 dark:bg-zinc-600"
                    )}
                >
                    <Text
                        className={cx(
                            "text-xs",
                            active ? "text-white" : "text-zinc-700 dark:text-zinc-100"
                        )}
                    >
                        {badge}
                    </Text>
                </View>
            )}
        </Pressable>
    );
};

export default TabButton;
