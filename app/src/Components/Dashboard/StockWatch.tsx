import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import Text from "../Elements/Text";
import { useAuth } from "../../Context/AuthContext";
import { useSettings } from "../../Context/SettingsContext";
import { cx } from "../../Lib/ClassNames";
import { IsOnline } from "../../Lib/Connection";
import { InventoryRowKey, InventorySizeLabel } from "../../Lib/ModelHelpers";
import type { InventoryItem } from "../../Models/InventoryItem";
import { GetInventory } from "../../Services/InventoryServices";

/** How many sizes to list before summarising the rest. */
const SHOW = 6;

/** How often the card refreshes on its own. */
const REFRESH_MS = 60000;

type Props = {
    /** Changes to make the card load again - the dashboard's pull to refresh. */
    refreshKey?: number;
};

/**
 * The accessories running out, so the floor knows what can still go home today and checkout knows
 * what to restock. Out-of-stock sizes first, then the ones down to their last couple.
 */
const StockWatch = ({ refreshKey = 0 }: Props) => {
    const { hasRole } = useAuth();
    const {
        settings: { lowStockAt: LOW },
    } = useSettings();
    const [items, setItems] = useState<InventoryItem[] | null>(null);

    useEffect(() => {
        const load = () =>
            GetInventory().then((rows) => {
                if (IsOnline()) setItems(rows);
            });
        load();
        const timer = setInterval(load, REFRESH_MS);
        return () => clearInterval(timer);
    }, [refreshKey]);

    // Nothing is tracked, so there is nothing to watch.
    if (!items || items.length === 0) return null;

    const watch = items
        .filter((i) => (i.quantityOnHand ?? 0) <= LOW)
        .sort((a, b) => (a.quantityOnHand ?? 0) - (b.quantityOnHand ?? 0));
    const outCount = watch.filter((i) => (i.quantityOnHand ?? 0) <= 0).length;
    const lowCount = watch.length - outCount;

    return (
        <View className="rounded-xl bg-white p-4 shadow-sm dark:bg-zinc-800">
            <View className="mb-3 flex-row items-center justify-between gap-2">
                <Text className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Stock to watch
                </Text>
                {hasRole("Checkout") && (
                    <Button
                        text="Inventory"
                        icon="fa-solid fa-boxes-stacked"
                        onClick={() => router.push("/more/inventory")}
                        className="min-h-[36px] bg-zinc-500 px-3 text-xs dark:bg-zinc-600"
                    />
                )}
            </View>

            {watch.length === 0 ? (
                <View className="flex-row items-center gap-2">
                    <Icon icon="fa-solid fa-circle-check" className="text-sm text-green-700 dark:text-green-400" />
                    <Text className="flex-1 text-sm text-green-700 dark:text-green-400">
                        Every counted size has more than {LOW} on hand.
                    </Text>
                </View>
            ) : (
                <>
                    <Text className="mb-1 text-xs text-zinc-600 dark:text-zinc-400">
                        {outCount > 0 && `${outCount} size${outCount === 1 ? "" : "s"} out`}
                        {outCount > 0 && lowCount > 0 && " · "}
                        {lowCount > 0 && `${lowCount} running low`}
                    </Text>
                    {watch.slice(0, SHOW).map((item, index) => {
                        const onHand = item.quantityOnHand ?? 0;
                        const out = onHand <= 0;
                        const color = out ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400";
                        return (
                            <View
                                key={InventoryRowKey(item)}
                                className={cx(
                                    "flex-row items-center gap-2 py-2",
                                    index > 0 && "border-t border-zinc-100 dark:border-zinc-700"
                                )}
                            >
                                <Text className="min-w-0 flex-1 text-sm">
                                    <Text className="text-sm font-medium">{item.productName}</Text>{" "}
                                    <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                                        {InventorySizeLabel(item)}
                                    </Text>
                                </Text>
                                {/* Status carries an icon and a word, never color alone. */}
                                <View className="flex-row items-center gap-1">
                                    <Icon
                                        icon={out ? "fa-solid fa-circle-xmark" : "fa-solid fa-triangle-exclamation"}
                                        className={cx("text-xs", color)}
                                    />
                                    <Text className={cx("text-xs font-semibold", color)}>
                                        {out ? "Out" : `${onHand} left`}
                                    </Text>
                                </View>
                            </View>
                        );
                    })}
                    {watch.length > SHOW && (
                        <Text className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                            and {watch.length - SHOW} more size{watch.length - SHOW === 1 ? "" : "s"}
                        </Text>
                    )}
                </>
            )}
        </View>
    );
};

export default StockWatch;
