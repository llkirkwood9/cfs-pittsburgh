import Icon from "../Elements/Icon";
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
            <div className="rounded-xl border-2 border-dashed border-zinc-300 py-10 text-center dark:border-zinc-700">
                <Icon icon="fa-solid fa-mug-hot" className="text-2xl text-zinc-400" />
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Nobody waiting.</p>
            </div>
        );
    }

    return (
        <ul className="space-y-2">
            {orders.map((order) => {
                const active = order.id === activeId;

                return (
                    <li key={order.id}>
                        <button
                            type="button"
                            onClick={() => order.id && onSelect(order.id)}
                            className={`flex w-full min-h-[72px] items-center gap-3 rounded-xl px-4 py-3 text-left
                                transition-colors ${
                                    active
                                        ? "bg-sky-700 text-white dark:bg-sky-600"
                                        : "bg-white text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                                }`}
                        >
                            <span
                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                                    active
                                        ? "bg-white/20"
                                        : "bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                                }`}
                            >
                                #{order.orderNumber}
                            </span>

                            <span className="min-w-0 flex-1">
                                <span className="block truncate font-semibold">
                                    {order.billingName || "No name yet"}
                                </span>
                                <span className="block text-xs opacity-80">
                                    {order.cfsRepName} &middot; {order.itemCount ?? 0} item
                                    {(order.itemCount ?? 0) === 1 ? "" : "s"} &middot;{" "}
                                    {FormatElapsed(order.submittedAt)}
                                </span>
                            </span>

                            <span className="shrink-0 text-right font-bold tabular-nums">
                                {FormatCurrency(order.total)}
                            </span>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
};

export default CheckoutQueue;
