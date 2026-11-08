import { View } from "react-native";
import Text from "../Elements/Text";
import { useBreakpoint } from "../../Hooks/UseBreakpoint";
import { cx } from "../../Lib/ClassNames";
import { OrderTotalRows } from "@shared/Lib/Sales";
import type { Order } from "@shared/Models/Order";

type Props = {
    order: Order;
    /** On a phone, show only the total and what is still owed, so the action bar stays short. */
    compact?: boolean;
};

/**
 * The totals box from the bottom right of the sales sheet. Every figure here is computed by the
 * API, so the screen and the printed receipt can never disagree.
 */
const OrderTotals = ({ order, compact = false }: Props) => {
    const { sm } = useBreakpoint();

    const rows = OrderTotalRows(order);

    const shown = rows.filter((row) => !compact || sm || row.phone);

    return (
        <View className="gap-1">
            {shown.map((row, index) => (
                <View
                    key={row.label}
                    className={cx(
                        "flex-row items-baseline justify-between gap-4",
                        row.strong &&
                            index > 0 &&
                            "border-t border-zinc-200 pt-1 dark:border-zinc-700"
                    )}
                >
                    <Text
                        className={cx(
                            row.strong ? "text-base font-bold" : "text-sm",
                            "text-zinc-600 dark:text-zinc-400"
                        )}
                    >
                        {row.label}
                    </Text>
                    <Text
                        className={cx(
                            row.strong ? "text-base font-bold" : "text-sm",
                            "tabular-nums"
                        )}
                    >
                        {row.value}
                    </Text>
                </View>
            ))}
        </View>
    );
};

export default OrderTotals;
