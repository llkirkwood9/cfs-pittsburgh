import { View } from "react-native";
import Button from "./Button";
import Text from "./Text";
import { cx } from "../../Lib/ClassNames";

type Props = {
    label?: string;
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    className?: string;
};

/**
 * A count with - and + either side: the dashboard's quantity control.
 */
const Stepper = ({ label, value, onChange, min = 1, max, className = "" }: Props) => (
    <View className={cx("gap-1", className)}>
        {label && (
            <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {label}
            </Text>
        )}
        <View className="flex-row items-center gap-2">
            <Button
                icon="fa-solid fa-minus"
                title="One fewer"
                onClick={() => onChange(Math.max(min, value - 1))}
                disabled={value <= min}
                className="bg-zinc-500 px-4"
            />
            <Text className="min-w-[36px] text-center text-xl font-bold tabular-nums">{value}</Text>
            <Button
                icon="fa-solid fa-plus"
                title="One more"
                onClick={() => onChange(max === undefined ? value + 1 : Math.min(max, value + 1))}
                disabled={max !== undefined && value >= max}
                className="bg-zinc-500 px-4"
            />
        </View>
    </View>
);

export default Stepper;
