import { router } from "expo-router";
import { View } from "react-native";
import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import Text from "../Elements/Text";
import { useStockWatch } from "@shared/Hooks/useStockWatch";
import { cx } from "../../Lib/ClassNames";
import { ScreenLinks } from "../../Lib/ScreenLinks";

type Props = {
    /** Changes to make the card load again - the dashboard's pull to refresh. */
    refreshKey?: number;
};

/**
 * The accessories running out, so the floor knows what can still go home today and checkout knows
 * what to restock. Out-of-stock sizes first, then the ones down to their last couple.
 */
const StockWatch = ({ refreshKey = 0 }: Props) => {
    const stock = useStockWatch(refreshKey);

    // Nothing is tracked, so there is nothing to watch.
    if (!stock) return null;

    return (
        <View className="rounded-xl bg-white p-4 raised-sm dark:bg-zinc-800">
            <View className="mb-3 flex-row items-center justify-between gap-2">
                <Text className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Stock to watch
                </Text>
                {stock.canRestock && (
                    <Button
                        text="Inventory"
                        icon="fa-solid fa-boxes-stacked"
                        onClick={() => router.push(ScreenLinks.inventory.href)}
                        className="min-h-[36px] bg-zinc-500 px-3 text-xs dark:bg-zinc-600"
                    />
                )}
            </View>

            {stock.rows.length === 0 ? (
                <View className="flex-row items-center gap-2">
                    <Icon
                        icon="fa-solid fa-circle-check"
                        className="text-sm text-green-700 dark:text-green-400"
                    />
                    <Text className="flex-1 text-sm text-green-700 dark:text-green-400">
                        Every counted size has more than {stock.lowStockAt} on hand.
                    </Text>
                </View>
            ) : (
                <>
                    <Text className="mb-1 text-xs text-zinc-600 dark:text-zinc-400">
                        {stock.summary}
                    </Text>
                    {stock.rows.map((row, index) => {
                        const color = row.out
                            ? "text-red-700 dark:text-red-400"
                            : "text-amber-700 dark:text-amber-400";
                        return (
                            <View
                                key={row.key}
                                className={cx(
                                    "flex-row items-center gap-2 py-2",
                                    index > 0 && "border-t border-zinc-100 dark:border-zinc-700"
                                )}
                            >
                                <Text className="min-w-0 flex-1 text-sm">
                                    <Text className="text-sm font-medium">{row.productName}</Text>{" "}
                                    <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                                        {row.sizeLabel}
                                    </Text>
                                </Text>
                                {/* Status carries an icon and a word, never color alone. */}
                                <View className="flex-row items-center gap-1">
                                    <Icon
                                        icon={
                                            row.out
                                                ? "fa-solid fa-circle-xmark"
                                                : "fa-solid fa-triangle-exclamation"
                                        }
                                        className={cx("text-xs", color)}
                                    />
                                    <Text className={cx("text-xs font-semibold", color)}>
                                        {row.out ? "Out" : `${row.onHand} left`}
                                    </Text>
                                </View>
                            </View>
                        );
                    })}
                    {stock.moreText && (
                        <Text className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                            {stock.moreText}
                        </Text>
                    )}
                </>
            )}
        </View>
    );
};

export default StockWatch;
