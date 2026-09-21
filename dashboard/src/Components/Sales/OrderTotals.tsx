import { FormatCurrency, FormatRate } from "../../Lib/ModelHelpers";
import type { Order } from "../../Models/Order";

type Props = {
    order: Order;
    className?: string;
};

/**
 * The totals box from the bottom right of the sales sheet. Every figure here is computed by the
 * API, so the screen and the printed receipt can never disagree.
 */
const OrderTotals = ({ order, className = "" }: Props) => {
    const rows: { label: string; value: string; strong?: boolean }[] = [
        { label: "Subtotal", value: FormatCurrency(order.subtotal) },
        { label: `Sales tax (${FormatRate(order.salesTaxRate)})`, value: FormatCurrency(order.taxAmount) },
    ];

    if ((order.ccProcessingFee ?? 0) > 0)
        rows.push({ label: "CC processing fee", value: FormatCurrency(order.ccProcessingFee) });

    rows.push({ label: "Total", value: FormatCurrency(order.total), strong: true });

    if ((order.amountPaid ?? 0) > 0)
        rows.push({ label: "Paid", value: FormatCurrency(order.amountPaid) });

    rows.push({ label: "Balance due", value: FormatCurrency(order.balanceDue), strong: true });

    return (
        <dl className={`space-y-1 ${className}`}>
            {rows.map((row) => (
                <div
                    key={row.label}
                    className={`flex items-baseline justify-between gap-4 ${
                        row.strong
                            ? "border-t border-zinc-200 pt-1 text-base font-bold dark:border-zinc-700"
                            : "text-sm"
                    }`}
                >
                    <dt className="text-zinc-600 dark:text-zinc-400">{row.label}</dt>
                    <dd className="tabular-nums text-zinc-900 dark:text-zinc-100">{row.value}</dd>
                </div>
            ))}
        </dl>
    );
};

export default OrderTotals;
