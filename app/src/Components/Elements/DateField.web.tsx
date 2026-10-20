import { createElement } from "react";
import { View } from "react-native";
import Text from "./Text";
import { cx } from "../../Lib/ClassNames";

type Props = {
    label: string;
    /** The date as yyyy-mm-dd, like a date input's value. */
    value: string;
    onChange: (value: string) => void;
    className?: string;
};

/** In a browser the system picker is the date input itself. */
const DateField = ({ label, value, onChange, className = "" }: Props) => (
    <View className={cx("gap-1", className)}>
        <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {label}
        </Text>
        {createElement("input", {
            type: "date",
            value,
            "aria-label": label,
            onChange: (e: { target: { value: string } }) => onChange(e.target.value),
            style: {
                minHeight: 48,
                borderRadius: 12,
                border: "1px solid #d4d4d8",
                padding: "0 12px",
                fontSize: 16,
                fontFamily: "inherit",
                background: "transparent",
                color: "inherit",
                colorScheme: "light dark",
            },
        })}
    </View>
);

export default DateField;
