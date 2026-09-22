import { FormatCurrency, FormatRate } from "../../Lib/ModelHelpers";
import type { Order } from "../../Models/Order";

type Props = {
    order: Order;
    className?: string;
    /** On a phone, show only the total and what is still owed, so a sticky bar stays short. */
    compact?: boolean;
};

/**
 * The totals box from the bottom right of the sales sheet. Every figure here is computed by the
 * API, so the screen and the printed receipt can never disagree.
 */
const OrderTotals = ({ order, className = "", compact = false }: Props) => {
    const rows: { label: string; value: string; strong?: boolean; phone?: boolean }[] = [
        { label: "Subtotal", value: FormatCurrency(order.subtotal) },
        {
            label: `Sales tax (${FormatRate(order.salesTaxRate)})`,
            value: FormatCurrency(order.taxAmount),
        },
    ];

    if ((order.ccProcessingFee ?? 0) > 0)
        rows.push({ label: "CC processing fee", value: FormatCurrency(order.ccProcessingFee) });

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

    return (
        <dl className={`space-y-1 ${className}`}>
            {rows.map((row) => (
                <div
                    key={row.label}
                    className={`items-baseline justify-between gap-4 ${
                        compact && !row.phone ? "hidden sm:flex" : "flex"
                    } ${
                        row.strong
                            ? `text-base font-bold ${
                                  compact && row.phone && row.label === "Total"
                                      ? "sm:border-t sm:border-zinc-200 sm:pt-1 sm:dark:border-zinc-700"
                                      : "border-t border-zinc-200 pt-1 dark:border-zinc-700"
                              }`
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
