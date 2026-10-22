import { useState } from "react";
import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import Modal from "../Elements/Modal";
import { FormatCurrency } from "../../Lib/ModelHelpers";
import type { OrderSummary } from "../../Models/OrderSummary";

type Props = {
    order: OrderSummary;
    onReopen: (to: "floor" | "checkout") => Promise<void>;
    onClose: () => void;
};

/**
 * Admin-only: send an order back to the checkout table (to fix a payment) or the sales floor (to
 * change what was sold). A completed sale leaves the day's totals until it is completed again;
 * its recorded payments stay on it. A voided order comes back the same way, to be finished again.
 */
const ReopenOrderModal = ({ order, onReopen, onClose }: Props) => {
    const [working, setWorking] = useState<"floor" | "checkout" | null>(null);
    const completed = order.status === "Completed";
    const voided = order.status === "Voided";

    const reopen = async (to: "floor" | "checkout") => {
        setWorking(to);
        await onReopen(to);
        setWorking(null);
    };

    const choices: {
        to: "floor" | "checkout";
        title: string;
        detail: string;
        icon: string;
        show: boolean;
    }[] = [
        {
            to: "checkout",
            title: "Send to checkout",
            detail: "Fix a payment, the initials or the signature. The items stay as they are.",
            icon: "fa-solid fa-cash-register",
            show: order.status !== "AwaitingCheckout",
        },
        {
            to: "floor",
            title: "Send to the sales floor",
            detail: "Change what was sold. It opens as a draft for the rep who wrote it up.",
            icon: "fa-solid fa-cart-plus",
            show: order.status !== "Draft",
        },
    ];

    return (
        <Modal
            title={`Reopen order #${order.orderNumber}`}
            onClose={onClose}
            footer={
                <Button
                    text="Cancel"
                    onClick={onClose}
                    className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                />
            }
        >
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                {order.billingName || "No name"} &middot; {FormatCurrency(order.total)}
            </p>

            {completed && (
                <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    <Icon icon="fa-solid fa-triangle-exclamation" /> It leaves the event&apos;s
                    totals until it is completed again.
                </p>
            )}

            {voided && (
                <p className="mb-4 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
                    <Icon icon="fa-solid fa-circle-info" /> It is no longer void, and counts in the
                    event&apos;s totals once it is completed.
                </p>
            )}

            <div className="space-y-2">
                {choices
                    .filter((c) => c.show)
                    .map((c) => (
                        <button
                            key={c.to}
                            type="button"
                            disabled={working !== null}
                            onClick={() => reopen(c.to)}
                            className="flex w-full min-h-[72px] items-center gap-4 rounded-xl bg-zinc-100 px-4 py-3 text-left
                                transition-colors hover:bg-zinc-200 disabled:opacity-60 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                        >
                            <Icon
                                icon={working === c.to ? "fa-solid fa-circle-notch" : c.icon}
                                spin={working === c.to}
                                className="text-xl text-sky-700 dark:text-sky-400"
                            />
                            <span>
                                <span className="block font-semibold">{c.title}</span>
                                <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                                    {c.detail}
                                </span>
                            </span>
                        </button>
                    ))}
            </div>
        </Modal>
    );
};

export default ReopenOrderModal;
