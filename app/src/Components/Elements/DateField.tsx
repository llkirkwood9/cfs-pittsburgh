import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Platform, Pressable, View } from "react-native";
import Icon from "./Icon";
import Text from "./Text";
import { useTheme } from "../../Hooks/UseTheme";
import { cx } from "../../Lib/ClassNames";
import { FormatShortDate } from "../../Lib/ModelHelpers";

type Props = {
    label: string;
    /** The date as yyyy-mm-dd, like a date input's value. */
    value: string;
    onChange: (value: string) => void;
    className?: string;
};

/** A local date as yyyy-mm-dd. */
const ToValue = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** yyyy-mm-dd as a local date, or today when it is blank. */
const FromValue = (value: string) => (value ? new Date(`${value}T00:00:00`) : new Date());

/**
 * The dashboard's date input, with the system date picker: the compact calendar button on iOS,
 * the calendar dialog on Android. The value is yyyy-mm-dd either way.
 */
const DateField = ({ label, value, onChange, className = "" }: Props) => {
    const { isDark } = useTheme();
    const date = FromValue(value);

    const changed = (event: DateTimePickerEvent, picked?: Date) => {
        if (event.type === "set" && picked) onChange(ToValue(picked));
    };

    return (
        <View className={cx("gap-1", className)}>
            <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {label}
            </Text>
            {Platform.OS === "ios" ? (
                <View className="min-h-[48px] flex-row items-center rounded-xl border border-zinc-300 bg-white px-2 dark:border-zinc-600 dark:bg-zinc-800">
                    <DateTimePicker
                        value={date}
                        mode="date"
                        display="compact"
                        onChange={changed}
                        themeVariant={isDark ? "dark" : "light"}
                        accessibilityLabel={label}
                    />
                </View>
            ) : (
                <Pressable
                    onPress={() =>
                        DateTimePickerAndroid.open({ value: date, mode: "date", onChange: changed })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`${label}, ${value ? FormatShortDate(`${value}T00:00:00`) : "not set"}`}
                    className="min-h-[48px] flex-row items-center justify-between rounded-xl border border-zinc-300 bg-white px-3
                        dark:border-zinc-600 dark:bg-zinc-800"
                >
                    <Text className="text-base">{value ? FormatShortDate(`${value}T00:00:00`) : "Pick a date"}</Text>
                    <Icon icon="fa-regular fa-calendar" className="text-zinc-500 dark:text-zinc-400" />
                </Pressable>
            )}
        </View>
    );
};

export default DateField;
