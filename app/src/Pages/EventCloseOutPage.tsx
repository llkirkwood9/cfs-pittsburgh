import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import Button from "../Components/Elements/Button";
import ConfirmationModal from "../Components/Elements/ConfirmationModal";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import Page from "../Components/Elements/Page";
import SwipeRow from "../Components/Elements/SwipeRow";
import type { SwipeAction } from "../Components/Elements/SwipeRow";
import Text from "../Components/Elements/Text";
import { useRefreshOnFocus } from "../Hooks/UseRefreshOnFocus";
import { cx } from "../Lib/ClassNames";
import { useCloseOut } from "@shared/Hooks/useCloseOut";
import { CloseEventMessage, VoidsWhenCleared } from "@shared/Lib/CloseOut";
import type { CloseOutStep } from "@shared/Lib/CloseOut";
import { FormatCurrency, FormatShortDate } from "@shared/Lib/Format";
import type { OrderSummary } from "@shared/Models/OrderSummary";
import { Paths } from "../Lib/ScreenLinks";

/**
 * Closing out an event: everything worth checking before the cart packs up, in one list. Orders
 * still on the floor or waiting at checkout, balances still owed, the start and end stock counts,
 * then printing the event's sheets and closing the event so nothing more is sold under it.
 */
const EventCloseOutPage = () => {
    const { eventId } = useLocalSearchParams<{ eventId: string }>();
    const id = Number(eventId);
    const {
        saleEvent,
        loading,
        load,
        canClear,
        active,
        summary,
        steps,
        blocking,
        confirming,
        setConfirming,
        closing,
        closeEvent,
        clearing,
        setClearing,
        askOne,
        askAll,
        working,
        clearOrders,
    } = useCloseOut(id);
    const [refreshing, setRefreshing] = useState<boolean>(false);

    const handleRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    // Back from an order opened from the list: read the list again.
    useRefreshOnFocus(load);

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

    const { completed, takings, endAt } = summary;

    const clear = () => {
        if (!clearing) return;
        // The system alert has already closed; let it go before working through the list.
        const list = clearing.orders;
        setClearing(null);
        clearOrders(list);
    };

    // Tap an order to open it; an administrator swipes it to discard or void it.
    const orderList = (step: CloseOutStep, list: OrderSummary[]) => (
        <View className="mt-2 gap-1">
            {list.map((o) => {
                const actions: SwipeAction[] =
                    step.clearable && canClear
                        ? [
                              VoidsWhenCleared(o)
                                  ? {
                                        label: "Void",
                                        icon: "fa-solid fa-ban",
                                        tone: "danger",
                                        onPress: () => askOne(o),
                                    }
                                  : {
                                        label: "Discard",
                                        icon: "fa-solid fa-trash",
                                        tone: "danger",
                                        onPress: () => askOne(o),
                                    },
                          ]
                        : [];
                return (
                    <SwipeRow
                        key={o.id}
                        variant="row"
                        onPress={() =>
                            router.navigate(
                                step.key === "checkout"
                                    ? Paths.checkoutOrder(o.id!)
                                    : Paths.receipt(o.id!)
                            )
                        }
                        actions={actions}
                        accessibilityLabel={`Order ${o.orderNumber}, ${o.billingName || "no name yet"}`}
                        containerClassName="overflow-hidden rounded-lg"
                        className="min-h-[44px] flex-row items-center gap-3 bg-zinc-50 px-3 py-2 dark:bg-zinc-900/40"
                    >
                        <Text className="text-sm font-bold tabular-nums">#{o.orderNumber}</Text>
                        <Text className="min-w-0 flex-1 text-sm" numberOfLines={1}>
                            {o.billingName || o.draftLabel || "No name yet"}
                            {o.cfsRepName ? (
                                <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                                    {" "}
                                    · {o.cfsRepName}
                                </Text>
                            ) : null}
                        </Text>
                        <Text className="text-sm tabular-nums">
                            {FormatCurrency(o.balanceDue ?? o.total)}
                        </Text>
                        <Icon icon="fa-solid fa-chevron-right" className="text-xs text-zinc-400" />
                    </SwipeRow>
                );
            })}
        </View>
    );

    const stepAction = (step: CloseOutStep) => {
        if (step.clearAll && canClear && (step.orders?.length ?? 0) > 1) {
            const { what, text } = step.clearAll;
            return (
                <Button
                    text={text}
                    icon={text === "Void all" ? "fa-solid fa-ban" : "fa-solid fa-broom"}
                    onClick={() => askAll(step.orders ?? [], what)}
                    loading={working}
                    className="min-h-[40px] bg-red-700 px-3 text-sm dark:bg-red-600"
                />
            );
        }
        if (step.key === "end" && active) {
            return (
                <Button
                    text={endAt ? "Recount" : "Count now"}
                    icon="fa-solid fa-clipboard-check"
                    onClick={() => router.push(Paths.inventoryCount("end"))}
                    className="min-h-[40px] px-3 text-sm"
                />
            );
        }
        return null;
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
                        <View
                            key={step.key}
                            className="rounded-xl bg-white p-4 raised-sm dark:bg-zinc-800"
                        >
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
                                    {step.orders?.length ? orderList(step, step.orders) : null}
                                </View>
                                {stepAction(step)}
                            </View>
                        </View>
                    ))}

                    <View className="rounded-xl bg-white p-4 raised-sm dark:bg-zinc-800">
                        <View className="flex-row flex-wrap items-center gap-3">
                            <Icon icon="fa-solid fa-print" className="text-lg text-zinc-500" />
                            <View className="min-w-[200px] flex-1">
                                <Text className="font-semibold">Print the event&apos;s sheets</Text>
                                <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                                    Stat sheet, sales sheets and inventory sheet.
                                </Text>
                            </View>
                            <Button
                                text="Sales sheets"
                                icon="fa-solid fa-print"
                                onClick={() => router.push(Paths.eventSheets(id))}
                                className="min-h-[40px] px-3 text-sm"
                            />
                        </View>
                    </View>
                </View>

                {active && (
                    <View className="mt-5 rounded-xl border-2 border-zinc-200 p-4 dark:border-zinc-700">
                        <Text className="font-semibold">Close the event</Text>
                        <Text className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
                            No new orders can be taken once it&apos;s closed.
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
                    message={CloseEventMessage(saleEvent.organization, blocking)}
                    confirmText={closing ? "Closing..." : "Close event"}
                    onConfirm={() => closeEvent(() => router.back())}
                    onCancel={() => setConfirming(false)}
                />
            )}

            {clearing && (
                <ConfirmationModal
                    title={clearing.title}
                    message={clearing.message}
                    confirmText={clearing.confirmText}
                    destructive
                    onConfirm={clear}
                    onCancel={() => setClearing(null)}
                />
            )}
        </Page>
    );
};

export default EventCloseOutPage;
