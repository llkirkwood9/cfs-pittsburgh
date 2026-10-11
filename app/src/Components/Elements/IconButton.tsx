import { Pressable } from "react-native";
import Icon from "./Icon";
import { cx } from "../../Lib/ClassNames";

type Props = {
    icon: string;
    /** What a screen reader says, since there is no text. */
    label: string;
    onPress: () => void;
    disabled?: boolean;
    /** Red, for delete and remove. */
    danger?: boolean;
    /** Size classes; a 40-point square by default. */
    className?: string;
};

/**
 * The dashboard's bare icon buttons - move up, move down, delete - with no fill until pressed.
 */
const IconButton = ({ icon, label, onPress, disabled = false, danger = false, className = "h-10 w-10" }: Props) => (
    <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        hitSlop={4}
        className={cx(
            "items-center justify-center rounded-lg",
            danger
                ? "active:bg-red-100 dark:active:bg-red-950/40"
                : "active:bg-zinc-100 dark:active:bg-zinc-700",
            disabled && "opacity-30",
            className
        )}
    >
        <Icon
            icon={icon}
            className={danger ? "text-red-700 dark:text-red-400" : "text-zinc-600 dark:text-zinc-300"}
        />
    </Pressable>
);

export default IconButton;
