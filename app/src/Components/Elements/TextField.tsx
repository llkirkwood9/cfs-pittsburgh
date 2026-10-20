import { TextInput, View } from "react-native";
import type { KeyboardTypeOptions } from "react-native";
import Text from "./Text";
import { cx } from "../../Lib/ClassNames";

type Props = {
    label: string;
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    onSubmit?: () => void;
    placeholder?: string;
    type?: "text" | "email" | "tel" | "password";
    inputMode?: "text" | "decimal" | "numeric" | "tel" | "email";
    className?: string;
    disabled?: boolean;
    maxLength?: number;
    autoFocus?: boolean;
    autoCapitalize?: "none" | "sentences" | "words" | "characters";
    /** Lets the phone's password manager recognise the field and fill it in. */
    autoComplete?: "username" | "current-password" | "new-password";
};

/** The same hints in iOS's words. */
const contentTypes = {
    username: "username",
    "current-password": "password",
    "new-password": "newPassword",
} as const;

const keyboards: Record<string, KeyboardTypeOptions> = {
    decimal: "decimal-pad",
    numeric: "number-pad",
    tel: "phone-pad",
    email: "email-address",
};

/**
 * Labelled text input, styled like the dashboard's. The keyboard follows the kind of value: a
 * number pad for prices and PINs, the phone pad for phone numbers, the email keyboard for email.
 */
const TextField = ({
    label,
    value,
    onChange,
    onBlur,
    onSubmit,
    placeholder,
    type = "text",
    inputMode,
    className = "",
    disabled = false,
    maxLength,
    autoFocus = false,
    autoCapitalize,
    autoComplete,
}: Props) => {
    const mode = inputMode ?? (type === "email" ? "email" : type === "tel" ? "tel" : "text");

    return (
        <View className={cx("gap-1", className)}>
            <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {label}
            </Text>
            <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                onSubmitEditing={onSubmit}
                placeholder={placeholder}
                placeholderTextColor="#a1a1aa"
                editable={!disabled}
                maxLength={maxLength}
                autoFocus={autoFocus}
                secureTextEntry={type === "password"}
                autoComplete={autoComplete}
                textContentType={autoComplete ? contentTypes[autoComplete] : undefined}
                keyboardType={keyboards[mode] ?? "default"}
                autoCapitalize={
                    autoCapitalize ?? (mode === "email" || type === "password" ? "none" : "sentences")
                }
                autoCorrect={mode === "text" && type === "text"}
                accessibilityLabel={label}
                className={cx(
                    "min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-base text-zinc-900",
                    "focus:border-sky-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-sky-500",
                    disabled && "opacity-60"
                )}
            />
        </View>
    );
};

export default TextField;
