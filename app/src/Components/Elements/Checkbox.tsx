import type { ReactNode } from "react";
import { Platform, Pressable, Switch, View } from "react-native";
import Text from "./Text";
import { cx } from "../../Lib/ClassNames";

type Props = {
    label: ReactNode;
    checked: boolean;
    onChange: (checked: boolean) => void;
    /** A smaller line under the label. */
    hint?: ReactNode;
    disabled?: boolean;
    className?: string;
};

/**
 * The dashboard's labelled tick box, as a native switch: the label on a grey row, the system
 * switch at the end. The whole row toggles it, so it is easy to hit.
 */
const Checkbox = ({ label, checked, onChange, hint, disabled = false, className = "" }: Props) => {
    return (
        <Pressable
            onPress={() => !disabled && onChange(!checked)}
            disabled={disabled}
            accessibilityRole="switch"
            accessibilityState={{ checked, disabled }}
            className={cx(
                "min-h-[48px] flex-row items-center gap-3 rounded-xl bg-zinc-100 px-3 py-2 dark:bg-zinc-700",
                disabled && "opacity-60",
                className
            )}
        >
            <View className="flex-1">
                {typeof label === "string" ? (
                    <Text className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                        {label}
                    </Text>
                ) : (
                    label
                )}
                {hint !== undefined &&
                    hint !== null &&
                    hint !== false &&
                    (typeof hint === "string" ? (
                        <Text className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</Text>
                    ) : (
                        hint
                    ))}
            </View>
            <Switch
                value={checked}
                onValueChange={onChange}
                disabled={disabled}
                trackColor={{ true: "#0284c7", false: Platform.OS === "android" ? "#a1a1aa" : undefined }}
                thumbColor={Platform.OS === "android" ? "#ffffff" : undefined}
            />
        </Pressable>
    );
};

export default Checkbox;
