import { Pressable, TextInput, View } from "react-native";
import Text from "./Text";
import { cx } from "../../Lib/ClassNames";

export type DiscountMode = "percent" | "amount";

type Props = {
    label: string;
    mode: DiscountMode;
    onModeChange: (mode: DiscountMode) => void;
    value: string;
    onChange: (value: string) => void;
    className?: string;
};

/**
 * A discount as a percent or a dollar amount: the %/$ switch beside the number, as on the
 * dashboard.
 */
const DiscountInput = ({ label, mode, onModeChange, value, onChange, className = "" }: Props) => (
    <View className={cx("gap-1", className)}>
        <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {label}
        </Text>
        <View className="flex-row gap-2">
            <View
                accessibilityRole="radiogroup"
                accessibilityLabel="Discount type"
                className="flex-row overflow-hidden rounded-xl border border-zinc-300 dark:border-zinc-600"
            >
                {(["percent", "amount"] as const).map((option) => (
                    <Pressable
                        key={option}
                        onPress={() => onModeChange(option)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: mode === option }}
                        accessibilityLabel={option === "percent" ? "Percent" : "Dollar amount"}
                        className={cx(
                            "min-h-[48px] w-11 items-center justify-center",
                            mode === option ? "bg-sky-700 dark:bg-sky-600" : "bg-white dark:bg-zinc-800"
                        )}
                    >
                        <Text
                            className={cx(
                                "text-base font-bold",
                                mode === option ? "text-white" : "text-zinc-700 dark:text-zinc-200"
                            )}
                        >
                            {option === "percent" ? "%" : "$"}
                        </Text>
                    </Pressable>
                ))}
            </View>
            <TextInput
                value={value}
                onChangeText={onChange}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#a1a1aa"
                accessibilityLabel={mode === "percent" ? "Discount percent" : "Discount amount off each"}
                className="min-h-[48px] min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-3 text-base
                    text-zinc-900 focus:border-sky-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
        </View>
    </View>
);

export default DiscountInput;
