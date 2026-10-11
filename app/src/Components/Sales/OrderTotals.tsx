import { View } from "react-native";
import Text from "../Elements/Text";
import { useBreakpoint } from "../../Hooks/UseBreakpoint";
import { cx } from "../../Lib/ClassNames";
import { FormatCurrency, FormatRate } from "../../Lib/ModelHelpers";
import type { Order } from "../../Models/Order";

type Props = {
    order: Order;
    className?: string;
    /** On a phone, show only the total and what is still owed, so the action bar stays short. */
    compact?: boolean;
};

/**
 * The totals box from the bottom right of the sales sheet. Every figure here is computed by the
 * API, so the screen and the printed receipt can never disagree.
 */
const OrderTotals = ({ order, className = "", compact = false }: Props) => {
    const { sm } = useBreakpoint();

    const rows: { label: string; value: string; strong?: boolean; phone?: boolean }[] = [
        { label: "Subtotal", value: FormatCurrency(order.subtotal) },
        {
            label: `Sales tax (${FormatRate(order.salesTaxRate)})`,
            value: FormatCurrency(order.taxAmount),
        },
    ];

    if ((order.ccProcessingFee ?? 0) > 0)
        rows.push({ label: "CC processing fee", value: FormatCurrency(order.ccProcessingFee) });
    else if (
        order.waiveCcProcessingFee &&
        (order.applyCcProcessingFee || (order.payments ?? []).some((p) => p.method === "VisaMc"))
    )
        rows.push({ label: "CC processing fee", value: "Waived" });

    const paid = (order.amountPaid ?? 0) > 0;

    rows.push({ label: "Total", value: FormatCurrency(order.total), strong: true, phone: true });

    if (paid) rows.push({ label: "Paid", value: FormatCurrency(order.amountPaid) });

    // Until something is paid the balance is just the total again, so a phone skips it.
    rows.push({
        label: "Balance due",
        value: FormatCurrency(order.balanceDue),
        strong: true,
        phone: paid,
    });

    const shown = rows.filter((row) => !compact || sm || row.phone);

    return (
        <View className={cx("gap-1", className)}>
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
                    <Text className={cx(row.strong ? "text-base font-bold" : "text-sm", "tabular-nums")}>
                        {row.value}
                    </Text>
                </View>
            ))}
        </View>
    );
};

export default OrderTotals;
