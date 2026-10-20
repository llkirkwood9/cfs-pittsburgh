import { Pressable, View } from "react-native";
import Icon from "./Icon";
import Text from "./Text";
import { cx, HasBackground, HasTextColor } from "../../Lib/ClassNames";

type Props = {
    id?: string;
    text?: string;
    icon?: string;
    onClick?: () => void;
    className?: string;
    disabled?: boolean;
    loading?: boolean;
    title?: string;
};

/** Text classes in a button's className go on its label; the rest go on the button itself. */
const TEXT_CLASS = /^(dark:)?(text-|font-|tracking-|uppercase|normal-case)/;

/**
 * The single button primitive. Minimum height is 48 because every control in this app has to be
 * hittable with a thumb on a tablet held in one hand. Takes the dashboard's classes unchanged:
 * colours and spacing style the button, text sizes and colours style its label.
 */
const Button = ({
    id,
    text,
    icon,
    onClick,
    className = "",
    disabled = false,
    loading = false,
    title,
}: Props) => {
    const tokens = className.split(/\s+/).filter(Boolean);
    const textClasses = tokens.filter((t) => TEXT_CLASS.test(t)).join(" ");
    const boxClasses = tokens.filter((t) => !TEXT_CLASS.test(t)).join(" ");
    const inactive = disabled || loading;

    const labelClass = cx(!HasTextColor(textClasses) && "text-white", "font-semibold", textClasses);

    return (
        <Pressable
            nativeID={id}
            onPress={onClick}
            disabled={inactive}
            accessibilityRole="button"
            // The label read out is the button's text; a title explains it further, as a tooltip
            // does on the dashboard.
            accessibilityLabel={text ?? title}
            accessibilityHint={text ? title : undefined}
            accessibilityState={{ disabled: inactive, busy: loading }}
            className={cx(
                "min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl px-5 active:opacity-80",
                // Only use the default blue when the caller gives no colour of its own.
                !HasBackground(boxClasses) && "bg-sky-700 dark:bg-sky-600",
                inactive && "opacity-50",
                boxClasses
            )}
        >
            {loading ? (
                <Icon icon="fa-solid fa-circle-notch" spin className={labelClass} />
            ) : (
                icon && <Icon icon={icon} className={labelClass} />
            )}
            {text ? (
                <Text className={labelClass} numberOfLines={1}>
                    {text}
                </Text>
            ) : (
                !icon && !loading && <View />
            )}
        </Pressable>
    );
};

export default Button;
