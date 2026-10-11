import { TextInput, View } from "react-native";
import Text from "./Text";
import { cx } from "../../Lib/ClassNames";

type Props = {
    label: string;
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    maxLength?: number;
    rows?: number;
};

/**
 * Labelled multi-line text box, styled to match TextField.
 */
const TextArea = ({
    label,
    value,
    onChange,
    onBlur,
    placeholder,
    className = "",
    disabled = false,
    maxLength,
    rows = 2,
}: Props) => {
    return (
        <View className={cx("gap-1", className)}>
            <View className="flex-row items-baseline justify-between gap-2">
                <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {label}
                </Text>
                {maxLength !== undefined && value.length > maxLength * 0.8 && (
                    <Text className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                        {value.length}/{maxLength}
                    </Text>
                )}
            </View>
            <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder={placeholder}
                placeholderTextColor="#a1a1aa"
                editable={!disabled}
                maxLength={maxLength}
                multiline
                textAlignVertical="top"
                accessibilityLabel={label}
                style={{ minHeight: Math.max(2, rows) * 24 + 20 }}
                className={cx(
                    "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900",
                    "focus:border-sky-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-sky-500",
                    disabled && "opacity-60"
                )}
            />
        </View>
    );
};

export default TextArea;
