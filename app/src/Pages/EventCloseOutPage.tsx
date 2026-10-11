import { router, Stack, useLocalSearchParams } from "expo-router";
import type { Href } from "expo-router";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import Button from "../Components/Elements/Button";
import ConfirmationModal from "../Components/Elements/ConfirmationModal";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import Page from "../Components/Elements/Page";
import Text from "../Components/Elements/Text";
import { cx } from "../Lib/ClassNames";
import { FormatCurrency, FormatShortDate, FormatTime } from "../Lib/ModelHelpers";
import { Toast } from "../Lib/Toast";
import type { Event } from "../Models/Event";
import type { InventoryItem } from "../Models/InventoryItem";
import type { OrderSummary } from "../Models/OrderSummary";
import { GetEvent, UpdateEvent } from "../Services/EventServices";
import { GetInventory } from "../Services/InventoryServices";
import { GetOrdersForEvent } from "../Services/OrderServices";

type Step = {
    key: string;
    title: string;
    done: boolean;
    /** A step that is fine to leave, such as a layaway balance, shows as information not a warning. */
    optional?: boolean;
    summary: string;
    children?: ReactNode;
    action?: ReactNode;
};

/** Where an order opens: its sales sheet, or the checkout screen for one waiting to be paid. */
const receipt = (o: OrderSummary): Href => ({
    pathname: "/receipt/[orderId]",
    params: { orderId: String(o.id) },
});
const checkout = (o: OrderSummary): Href => ({
    pathname: "/checkout",
    params: { orderId: String(o.id) },
});

/**
 * Closing out an event: everything worth checking before the cart packs up, in one list. Orders
 * still on the floor or waiting at checkout, balances still owed, the start and end stock counts,
 * then printing the event's sheets and closing the event so nothing more is sold under it.
 */
const EventCloseOutPage = () => {
    const { eventId } = useLocalSearchParams<{ eventId: string }>();
    const id = Number(eventId);

    const [saleEvent, setSaleEvent] = useState<Event | null>(null);
    const [orders, setOrders] = useState<OrderSummary[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [confirming, setConfirming] = useState<boolean>(false);
    const [closing, setClosing] = useState<boolean>(false);

    const load = async (eventNumber: number) => {
        if (!eventNumber) return setLoading(false);
        const [found, list, stock] = await Promise.all([
            GetEvent(eventNumber),
            GetOrdersForEvent(eventNumber),
            GetInventory(eventNumber),
        ]);
        setSaleEvent(found);
        setOrders(list);
        setInventory(stock);
        setLoading(false);
    };

    useEffect(() => {
        load(id);
    }, [id]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await load(id);
        setRefreshing(false);
    };

    if (loading) {
        return (
            <Page edges={["left", "right"]}>
                <ListSkeleton rows={5} />
            </Page>
        );
    }

    if (!saleEvent) {
        return (
            <Page edges={["left", "right"]}>
                <View className="items-center p-8">
                    <Text className="font-semibold">That event could not be found.</Text>
                    <Button
                        text="Back to events"
                        icon="fa-solid fa-arrow-left"
                        onClick={() => router.back()}
                        className="mt-4"
                    />
                </View>
            </Page>
        );
    }

    const drafts = orders.filter((o) => o.status === "Draft");
    const atCheckout = orders.filter((o) => o.status === "AwaitingCheckout");
    const completed = orders.filter((o) => o.status === "Completed");
    const owing = completed.filter((o) => (o.balanceDue ?? 0) > 0.004);
    const totalOwed = owing.reduce((sum, o) => sum + (o.balanceDue ?? 0), 0);
    const takings = completed.reduce((sum, o) => sum + (o.total ?? 0), 0);

    const latest = (at: (i: InventoryItem) => string | null | undefined) =>
        (inventory.map(at).filter(Boolean) as string[]).sort().pop() ?? null;
    const startAt = latest((i) => i.openingCountedAt);
    const endAt = latest((i) => i.countedAt);
    const tracks = inventory.length > 0;
    const active = Boolean(saleEvent.isActive);

    const orderList = (list: OrderSummary[], to: (o: OrderSummary) => Href) => (
        <View className="mt-2 gap-1">
            {list.map((o) => (
                <Pressable
                    key={o.id}
                    onPress={() => router.navigate(to(o))}
                    accessibilityRole="button"
                    className="min-h-[44px] flex-row items-center gap-3 rounded-lg bg-zinc-50 px-3 py-2 active:bg-zinc-100
                        dark:bg-zinc-900/40 dark:active:bg-zinc-700"
                >
                    <Text className="text-sm font-bold tabular-nums">#{o.orderNumber}</Text>
                    <Text className="min-w-0 flex-1 text-sm" numberOfLines={1}>
                        {o.billingName || o.draftLabel || "No name yet"}
                        {o.cfsRepName ? (
                            <Text className="text-sm text-zinc-500 dark:text-zinc-400"> · {o.cfsRepName}</Text>
                        ) : null}
                    </Text>
                    <Text className="text-sm tabular-nums">{FormatCurrency(o.balanceDue ?? o.total)}</Text>
                    <Icon icon="fa-solid fa-chevron-right" className="text-xs text-zinc-400" />
                </Pressable>
            ))}
        </View>
    );

    const steps: Step[] = [
        {
            key: "floor",
            title: "Nothing left on the sales floor",
            done: drafts.length === 0,
            summary:
                drafts.length === 0
                    ? "Every order has been sent to checkout or discarded."
                    : `${drafts.length} order${drafts.length === 1 ? " is" : "s are"} still being written up. Send ${
                          drafts.length === 1 ? "it" : "them"
                      } to checkout, or discard ${drafts.length === 1 ? "it" : "them"} on the Sell screen.`,
            children: drafts.length > 0 && orderList(drafts, receipt),
        },
        {
            key: "checkout",
            title: "Nobody waiting at checkout",
            done: atCheckout.length === 0,
            summary:
                atCheckout.length === 0
                    ? "Every order that reached checkout has been completed or voided."
                    : `${atCheckout.length} order${atCheckout.length === 1 ? " is" : "s are"} waiting to be paid.`,
            children: atCheckout.length > 0 && orderList(atCheckout, checkout),
        },
        {
            key: "balances",
            title: "Balances still owed",
            done: owing.length === 0,
            optional: true,
            summary:
                owing.length === 0
                    ? "Every completed sale is paid in full."
                    : `${owing.length} completed sale${owing.length === 1 ? "" : "s"} still owe${
                          owing.length === 1 ? "s" : ""
                      } ${FormatCurrency(totalOwed)} - normal for layaway and financing.`,
            children: owing.length > 0 && orderList(owing, receipt),
        },
        ...(tracks
            ? [
                  {
                      key: "start",
                      title: "Start-of-event count",
                      done: Boolean(startAt),
                      optional: true,
                      summary: startAt
                          ? `Taken at ${FormatTime(startAt)}.`
                          : "Not taken. The inventory sheet will have no starting figures.",
                  },
                  {
                      key: "end",
                      title: "End-of-event count",
                      done: Boolean(endAt),
                      summary: endAt
                          ? `Taken at ${FormatTime(endAt)}.`
                          : active
                            ? "Count what's left on the shelf before the event is closed."
                            : "Not taken. Counts can only be taken while the event is active.",
                      action: active && (
                          <Button
                              text={endAt ? "Recount" : "Count now"}
                              icon="fa-solid fa-clipboard-check"
                              onClick={() =>
                                  router.push({
                                      pathname: "/more/inventory/count/[phase]",
                                      params: { phase: "end" },
                                  })
                              }
                              className="min-h-[40px] px-3 text-sm"
                          />
                      ),
                  },
              ]
            : []),
    ];

    const blocking = steps.filter((s) => !s.done && !s.optional);

    const closeEvent = async () => {
        setClosing(true);
        const saved = await UpdateEvent({ id: saleEvent.id, isActive: false });
        setClosing(false);
        setConfirming(false);
        if (!saved) return;
        Toast.Success(`${saleEvent.organization} is closed.`);
        router.back();
    };

    return (
        <Page edges={["left", "right"]} onRefresh={handleRefresh} refreshing={refreshing}>
            <Stack.Screen options={{ title: `Close out ${saleEvent.organization}` }} />
            <View className="mx-auto w-full max-w-3xl">
                <Text className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                    {FormatShortDate(saleEvent.eventDate)} · {completed.length} completed sale
                    {completed.length === 1 ? "" : "s"} · {FormatCurrency(takings)}
                    {!active && " · This event is already closed."}
                </Text>

                <View className="gap-3">
                    {steps.map((step) => (
                        <View key={step.key} className="rounded-xl bg-white p-4 shadow-sm dark:bg-zinc-800">
                            <View className="flex-row flex-wrap items-start gap-3">
                                {/* Status is an icon plus the wording, never color alone. */}
                                <Icon
                                    icon={
                                        step.done
                                            ? "fa-solid fa-circle-check"
                                            : step.optional
                                              ? "fa-solid fa-circle-info"
                                              : "fa-solid fa-triangle-exclamation"
                                    }
                                    className={cx(
                                        "mt-0.5 text-lg",
                                        step.done
                                            ? "text-green-700 dark:text-green-400"
                                            : step.optional
                                              ? "text-sky-700 dark:text-sky-400"
                                              : "text-amber-700 dark:text-amber-400"
                                    )}
                                />
                                <View className="min-w-0 flex-1">
                                    <Text className="font-semibold">
                                        {step.title}
                                        <Text className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                                            {"  "}
                                            {step.done ? "Done" : step.optional ? "Check" : "To do"}
                                        </Text>
                                    </Text>
                                    <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                                        {step.summary}
                                    </Text>
                                    {step.children}
                                </View>
                                {step.action}
                            </View>
                        </View>
                    ))}

                    <View className="rounded-xl bg-white p-4 shadow-sm dark:bg-zinc-800">
                        <View className="flex-row flex-wrap items-center gap-3">
                            <Icon icon="fa-solid fa-print" className="text-lg text-zinc-500" />
                            <View className="min-w-[200px] flex-1">
                                <Text className="font-semibold">Print the event&apos;s sheets</Text>
                                <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                                    The stat sheet, every completed sales sheet and the Accessory
                                    Inventory Sheet, in one print job.
                                </Text>
                            </View>
                            <Button
                                text="Sales sheets"
                                icon="fa-solid fa-print"
                                onClick={() =>
                                    router.push({
                                        pathname: "/events/[eventId]/sheets",
                                        params: { eventId: String(id) },
                                    })
                                }
                                className="min-h-[40px] px-3 text-sm"
                            />
                        </View>
                    </View>
                </View>

                {active && (
                    <View className="mt-5 rounded-xl border-2 border-zinc-200 p-4 dark:border-zinc-700">
                        <Text className="font-semibold">Close the event</Text>
                        <Text className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
                            Closing makes it inactive, so no new orders can be taken under it. Its
                            orders, sheets and totals stay available, and it can be made active
                            again from Events if needed.
                        </Text>
                        <Button
                            text={blocking.length ? "Close anyway" : "Close event"}
                            icon="fa-solid fa-flag-checkered"
                            onClick={() => setConfirming(true)}
                            className={cx(
                                "self-start",
                                blocking.length
                                    ? "bg-amber-600 dark:bg-amber-600"
                                    : "bg-green-700 dark:bg-green-600"
                            )}
                        />
                    </View>
                )}
            </View>

            {confirming && (
                <ConfirmationModal
                    title={`Close ${saleEvent.organization}`}
                    message={
                        blocking.length
                            ? `There ${blocking.length === 1 ? "is" : "are"} still ${blocking.length} thing${
                                  blocking.length === 1 ? "" : "s"
                              } to do: ${blocking.map((b) => b.title.toLowerCase()).join("; ")}. Close the event anyway? Open orders stay open and can still be finished.`
                            : `Close ${saleEvent.organization}? No new orders can be taken under it once it's closed.`
                    }
                    confirmText={closing ? "Closing..." : "Close event"}
                    onConfirm={closeEvent}
                    onCancel={() => setConfirming(false)}
                />
            )}
        </Page>
    );
};

export default EventCloseOutPage;
