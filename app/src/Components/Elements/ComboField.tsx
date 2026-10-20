import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import Icon from "./Icon";
import Modal from "./Modal";
import Text from "./Text";
import { cx } from "../../Lib/ClassNames";

type Props = {
    label: string;
    value: string;
    onChange: (value: string) => void;
    /** Called when typing ends or a suggestion is picked, with the value to keep. */
    onCommit: (value: string) => void;
    suggestions: string[];
    disabled?: boolean;
    className?: string;
};

/**
 * A text box with a list to pick from as well - the dashboard's input with a datalist. Type a
 * name, or tap the list button and choose one.
 */
const ComboField = ({
    label,
    value,
    onChange,
    onCommit,
    suggestions,
    disabled = false,
    className = "",
}: Props) => {
    const [open, setOpen] = useState<boolean>(false);

    return (
        <View className={cx("gap-1", className)}>
            <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {label}
            </Text>
            <View
                className={cx(
                    "min-h-[48px] flex-row items-center rounded-xl border border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800",
                    disabled && "opacity-60"
                )}
            >
                <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={() => onCommit(value)}
                    editable={!disabled}
                    autoCapitalize="words"
                    accessibilityLabel={label}
                    placeholderTextColor="#a1a1aa"
                    className="min-h-[48px] flex-1 px-3 text-base text-zinc-900 dark:text-zinc-100"
                />
                {suggestions.length > 0 && !disabled && (
                    <Pressable
                        onPress={() => setOpen(true)}
                        accessibilityRole="button"
                        accessibilityLabel={`Choose a ${label.toLowerCase()}`}
                        className="h-12 w-12 items-center justify-center"
                    >
                        <Icon icon="fa-solid fa-list" className="text-sm text-zinc-500" />
                    </Pressable>
                )}
            </View>

            {open && (
                <Modal title={label} onClose={() => setOpen(false)}>
                    <View className="gap-1">
                        {suggestions.map((suggestion) => (
                            <Pressable
                                key={suggestion}
                                onPress={() => {
                                    onChange(suggestion);
                                    onCommit(suggestion);
                                    setOpen(false);
                                }}
                                accessibilityRole="button"
                                className={cx(
                                    "min-h-[52px] flex-row items-center rounded-xl px-3",
                                    suggestion === value
                                        ? "bg-sky-50 dark:bg-sky-950/50"
                                        : "active:bg-zinc-100 dark:active:bg-zinc-700"
                                )}
                            >
                                <Text className="flex-1 text-base">{suggestion}</Text>
                                {suggestion === value && (
                                    <Icon icon="fa-solid fa-check" className="text-sky-700 dark:text-sky-300" />
                                )}
                            </Pressable>
                        ))}
                    </View>
                </Modal>
            )}
        </View>
    );
};

export default ComboField;
