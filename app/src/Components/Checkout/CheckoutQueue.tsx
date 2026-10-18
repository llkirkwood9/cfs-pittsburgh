import { Pressable, View } from "react-native";
import Icon from "../Elements/Icon";
import Text from "../Elements/Text";
import { cx } from "../../Lib/ClassNames";
import { FormatCurrency, FormatElapsed } from "../../Lib/ModelHelpers";
import type { OrderSummary } from "../../Models/OrderSummary";

type Props = {
    orders: OrderSummary[];
    activeId: number | null;
    onSelect: (id: number) => void;
};

/**
 * Orders the floor has handed over, oldest first. The waiting time is shown on each tile so the
 * table can see at a glance who has been standing there longest.
 */
const CheckoutQueue = ({ orders, activeId, onSelect }: Props) => {
    if (orders.length === 0) {
        return (
            <View className="items-center rounded-xl border-2 border-dashed border-zinc-300 px-4 py-10 dark:border-zinc-700">
                <Icon icon="fa-solid fa-mug-hot" className="text-2xl text-zinc-400" />
                <Text className="mt-2 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    Nobody waiting.
                </Text>
            </View>
        );
    }

    return (
        <View className="gap-2">
            {orders.map((order) => {
                const active = order.id === activeId;
                const color = active ? "text-white" : "text-zinc-900 dark:text-zinc-100";

                return (
                    <Pressable
                        key={order.id}
                        onPress={() => order.id && onSelect(order.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        className={cx(
                            "min-h-[72px] w-full flex-row items-center gap-3 rounded-xl px-4 py-3",
                            active
                                ? "bg-sky-700 dark:bg-sky-600"
                                : "bg-white active:bg-zinc-200 dark:bg-zinc-800 dark:active:bg-zinc-700"
                        )}
                    >
                        <View
                            className={cx(
                                "h-11 min-w-[44px] items-center justify-center rounded-lg px-1",
                                active ? "bg-white/20" : "bg-zinc-100 dark:bg-zinc-700"
                            )}
                        >
                            <Text
                                className={cx(
                                    "text-sm font-bold",
                                    active ? "text-white" : "text-zinc-700 dark:text-zinc-200"
                                )}
                            >
                                #{order.orderNumber}
                            </Text>
                        </View>

                        <View className="min-w-0 flex-1">
                            <Text className={cx("font-semibold", color)} numberOfLines={1}>
                                {order.billingName || "No name yet"}
                            </Text>
                            <Text className={cx("text-xs opacity-80", color)}>
                                {order.cfsRepName} · {order.itemCount ?? 0} item
                                {(order.itemCount ?? 0) === 1 ? "" : "s"} · {FormatElapsed(order.submittedAt)}
                            </Text>
                        </View>

                        <Text className={cx("font-bold tabular-nums", color)}>
                            {FormatCurrency(order.total)}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
};

export default CheckoutQueue;
