import { OrderTotalRows } from "@shared/Lib/Sales";
import type { Order } from "@shared/Models/Order";

type Props = {
    order: Order;
    /** On a phone, show only the total and what is still owed, so a sticky bar stays short. */
    compact?: boolean;
};

/**
 * The totals box from the bottom right of the sales sheet. Every figure here is computed by the
 * API, so the screen and the printed receipt can never disagree.
 */
const OrderTotals = ({ order, compact = false }: Props) => {
    const rows = OrderTotalRows(order);

    return (
        <dl className="space-y-1">
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
