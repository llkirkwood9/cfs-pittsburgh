import { Pressable, View } from "react-native";
import Text from "../Elements/Text";
import { cx } from "../../Lib/ClassNames";
import { FormatCurrency } from "../../Lib/ModelHelpers";
import type { ProductOption } from "../../Models/ProductOption";

type Props = {
    option: ProductOption;
    picked?: number;
    onPick: (choiceId: number) => void;
    /** Units on hand if this choice were picked; null when not counted (or not yet knowable). */
    stockFor?: (choiceId: number) => number | null;
    /** Leave out price changes - an included item is free whatever its choice. */
    hidePrice?: boolean;
};

/**
 * One selection, such as Color, as a row of chips - like the sizes, so it works with a thumb.
 * Each chip shows any price change, and the stock for that choice when it is counted.
 */
const ChoicePicker = ({ option, picked, onPick, stockFor, hidePrice = false }: Props) => {
    const required = option.isRequired || option.tracksStock;

    return (
        <View>
            <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {option.name}
                {!required && <Text className="text-xs font-normal normal-case"> (optional)</Text>}
            </Text>
            <View accessibilityRole="radiogroup" accessibilityLabel={option.name} className="flex-row flex-wrap gap-2">
                {(option.choices ?? []).map((choice) => {
                    const stock = stockFor?.(choice.id ?? 0) ?? null;
                    const active = picked === choice.id;
                    const color = active ? "text-white" : "text-zinc-800 dark:text-zinc-100";
                    return (
                        <Pressable
                            key={choice.id}
                            onPress={() => onPick(choice.id ?? 0)}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: active }}
                            className={cx(
                                "min-h-[48px] justify-center rounded-xl px-4 py-1",
                                active
                                    ? "bg-sky-700 dark:bg-sky-600"
                                    : "bg-zinc-100 active:bg-zinc-200 dark:bg-zinc-700 dark:active:bg-zinc-600"
                            )}
                        >
                            <Text className={cx("text-sm font-semibold", color)}>
                                {choice.name}
                                {!hidePrice && (choice.priceAdjustment ?? 0) !== 0 && (
                                    <Text className={cx("text-sm font-normal", color)}>
                                        {" "}
                                        {(choice.priceAdjustment ?? 0) > 0 ? "+" : "-"}
                                        {FormatCurrency(Math.abs(choice.priceAdjustment ?? 0))}
                                    </Text>
                                )}
                            </Text>
                            {stock !== null && (
                                <Text className={cx("text-[11px] font-medium opacity-90", color)}>
                                    {stock > 0 ? `${stock} in stock` : "Out of stock"}
                                </Text>
                            )}
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
};

export default ChoicePicker;
