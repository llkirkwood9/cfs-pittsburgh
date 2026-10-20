import { useState } from "react";
import { Pressable, View } from "react-native";
import Icon from "./Icon";
import Modal from "./Modal";
import Text from "./Text";
import { cx } from "../../Lib/ClassNames";

export type SelectOption<T extends string | number | null> = {
    value: T;
    label: string;
    /** A smaller line under the label. */
    hint?: string;
};

type Props<T extends string | number | null> = {
    label: string;
    value: T;
    options: SelectOption<T>[];
    onChange: (value: T) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
};

/**
 * The app's drop-down: the dashboard's select box, opening a sheet of choices to tap. A sheet
 * suits a tablet in the hand better than a small menu, and works the same on iOS and Android.
 */
function SelectField<T extends string | number | null>({
    label,
    value,
    options,
    onChange,
    placeholder = "Choose...",
    className = "",
    disabled = false,
}: Props<T>) {
    const [open, setOpen] = useState<boolean>(false);
    const selected = options.find((o) => o.value === value);

    return (
        <View className={cx("gap-1", className)}>
            <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {label}
            </Text>
            <Pressable
                onPress={() => setOpen(true)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
                className={cx(
                    "min-h-[48px] flex-row items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3",
                    "active:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:active:bg-zinc-700",
                    disabled && "opacity-60"
                )}
            >
                <Text
                    className={cx(
                        "flex-1 text-base",
                        selected ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400"
                    )}
                    numberOfLines={1}
                >
                    {selected?.label ?? placeholder}
                </Text>
                <Icon icon="fa-solid fa-chevron-down" className="text-xs text-zinc-500" />
            </Pressable>

            {open && (
                <Modal title={label} onClose={() => setOpen(false)}>
                    <View className="gap-1">
                        {options.map((option) => {
                            const active = option.value === value;
                            return (
                                <Pressable
                                    key={String(option.value)}
                                    onPress={() => {
                                        onChange(option.value);
                                        setOpen(false);
                                    }}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: active }}
                                    className={cx(
                                        "min-h-[52px] flex-row items-center gap-3 rounded-xl px-3",
                                        active
                                            ? "bg-sky-50 dark:bg-sky-950/50"
                                            : "active:bg-zinc-100 dark:active:bg-zinc-700"
                                    )}
                                >
                                    <View className="flex-1">
                                        <Text
                                            className={cx(
                                                "text-base",
                                                active
                                                    ? "font-semibold text-sky-800 dark:text-sky-200"
                                                    : "text-zinc-800 dark:text-zinc-100"
                                            )}
                                        >
                                            {option.label}
                                        </Text>
                                        {option.hint && (
                                            <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                                                {option.hint}
                                            </Text>
                                        )}
                                    </View>
                                    {active && (
                                        <Icon
                                            icon="fa-solid fa-check"
                                            className="text-sky-700 dark:text-sky-300"
                                        />
                                    )}
                                </Pressable>
                            );
                        })}
                    </View>
                </Modal>
            )}
        </View>
    );
}

export default SelectField;
