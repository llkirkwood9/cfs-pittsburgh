import { useState } from "react";
import { Pressable, View } from "react-native";
import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import Modal from "../Elements/Modal";
import Text from "../Elements/Text";
import { cx } from "../../Lib/ClassNames";
import { FormatCurrency } from "@shared/Lib/Format";
import { ReopenChoices, type ReopenTarget } from "@shared/Lib/Orders";
import type { OrderSummary } from "@shared/Models/OrderSummary";

type Props = {
    order: OrderSummary;
    onReopen: (to: ReopenTarget) => Promise<void>;
    onClose: () => void;
};

/**
 * Admin-only: send an order back to the checkout table (to fix a payment) or the sales floor (to
 * change what was sold). A completed sale leaves the day's totals until it is completed again;
 * its recorded payments stay on it. A voided order comes back the same way, to be finished again.
 */
const ReopenOrderModal = ({ order, onReopen, onClose }: Props) => {
    const [working, setWorking] = useState<ReopenTarget | null>(null);
    const completed = order.status === "Completed";
    const voided = order.status === "Voided";

    const reopen = async (to: ReopenTarget) => {
        setWorking(to);
        await onReopen(to);
        setWorking(null);
    };

    const choices = ReopenChoices(order.status);

    return (
        <Modal
            title={`Reopen order #${order.orderNumber}`}
            onClose={onClose}
            footer={
                <Button text="Cancel" onClick={onClose} className="bg-zinc-500 dark:bg-zinc-600" />
            }
        >
            <Text className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                {order.billingName || "No name"} · {FormatCurrency(order.total)}
            </Text>

            {completed && (
                <View className="mb-4 flex-row gap-2 rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-950/40">
                    <Icon
                        icon="fa-solid fa-triangle-exclamation"
                        className="mt-0.5 text-sm text-amber-800 dark:text-amber-300"
                    />
                    <Text className="flex-1 text-sm text-amber-800 dark:text-amber-300">
                        It leaves the event&apos;s totals until it is completed again.
                    </Text>
                </View>
            )}

            {voided && (
                <View className="mb-4 flex-row gap-2 rounded-lg bg-sky-50 px-3 py-2 dark:bg-sky-950/40">
                    <Icon
                        icon="fa-solid fa-circle-info"
                        className="mt-0.5 text-sm text-sky-800 dark:text-sky-300"
                    />
                    <Text className="flex-1 text-sm text-sky-800 dark:text-sky-300">
                        It is no longer void, and counts in the event&apos;s totals once it is
                        completed.
                    </Text>
                </View>
            )}

            <View className="gap-2">
                {choices.map((c) => (
                    <Pressable
                        key={c.to}
                        disabled={working !== null}
                        onPress={() => reopen(c.to)}
                        accessibilityRole="button"
                        className={cx(
                            "min-h-[72px] w-full flex-row items-center gap-4 rounded-xl bg-zinc-100 px-4 py-3",
                            "active:bg-zinc-200 dark:bg-zinc-700 dark:active:bg-zinc-600",
                            working !== null && "opacity-60"
                        )}
                    >
                        <Icon
                            icon={working === c.to ? "fa-solid fa-circle-notch" : c.icon}
                            spin={working === c.to}
                            className="text-xl text-sky-700 dark:text-sky-400"
                        />
                        <View className="flex-1">
                            <Text className="font-semibold">{c.title}</Text>
                            <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                                {c.detail}
                            </Text>
                        </View>
                    </Pressable>
                ))}
            </View>
        </Modal>
    );
};

export default ReopenOrderModal;
