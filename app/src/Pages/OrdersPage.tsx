import { router } from "expo-router";
import { useState } from "react";
import { FlatList, RefreshControl, ScrollView, View } from "react-native";
import ReopenOrderModal from "../Components/Admin/ReopenOrderModal";
import EventFilter from "../Components/Dashboard/EventFilter";
import Button from "../Components/Elements/Button";
import ConfirmationModal from "../Components/Elements/ConfirmationModal";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import Page from "../Components/Elements/Page";
import SwipeRow from "../Components/Elements/SwipeRow";
import type { SwipeAction } from "../Components/Elements/SwipeRow";
import TabButton from "../Components/Elements/TabButton";
import Text from "../Components/Elements/Text";
import TextField from "../Components/Elements/TextField";
import { useTerritory } from "@shared/Context/TerritoryContext";
import { useActiveEventChange } from "../Hooks/UseActiveEventChange";
import { useRefreshOnFocus } from "../Hooks/UseRefreshOnFocus";
import { cx } from "../Lib/ClassNames";
import { useOrders } from "@shared/Hooks/useOrders";
import { FormatCurrency, FormatShortDate, FormatTime } from "@shared/Lib/Format";
import {
    CanReopenFromList,
    CanVoidFromList,
    DeleteOrderMessage,
    OrderStatusFilters,
    OrderStatusLabels,
    SummarizeOrders,
    VoidOrderMessage,
} from "@shared/Lib/OrderList";
import type { OrderStatus } from "@shared/Models/Order";
import type { OrderSummary } from "@shared/Models/OrderSummary";
import { Paths } from "../Lib/ScreenLinks";

const statusStyles: Record<OrderStatus, { box: string; text: string }> = {
    Draft: { box: "bg-zinc-200 dark:bg-zinc-700", text: "text-zinc-700 dark:text-zinc-200" },
    AwaitingCheckout: {
        box: "bg-amber-100 dark:bg-amber-900/50",
        text: "text-amber-800 dark:text-amber-300",
    },
    Completed: {
        box: "bg-green-100 dark:bg-green-900/50",
        text: "text-green-800 dark:text-green-300",
    },
    Voided: { box: "bg-red-100 dark:bg-red-900/50", text: "text-red-800 dark:text-red-300" },
};

/**
 * Past orders. Everyone can look back over the event they are working and open any sales sheet
 * for reprinting; a manager or above can additionally search across every event in their
 * territories (a system admin or administrator, every territory).
 */
const OrdersPage = () => {
    const { viewingAll: showTerritory } = useTerritory();
    // Viewing every territory, each order says which one it came from.
    const {
        isManager,
        isSystemAdmin,
        events,
        scope,
        orders,
        statusFilter,
        search,
        setSearch,
        loading,
        switchScope,
        switchStatus,
        runSearch,
        reopening,
        setReopening,
        handleReopen,
        voiding,
        setVoiding,
        handleVoid,
        removing,
        setRemoving,
        handleRemove,
        activeId,
        boot,
        refresh,
    } = useOrders();
    const [refreshing, setRefreshing] = useState<boolean>(false);

    const checkActiveEvent = useActiveEventChange(loading ? undefined : activeId, boot);

    // A change of active event starts the screen again; otherwise the same list, read again.
    const reload = async () => {
        if (await checkActiveEvent()) return;
        await refresh();
    };

    const handleRefresh = async () => {
        if (!scope) return;
        setRefreshing(true);
        await reload();
        setRefreshing(false);
    };

    // Back on this screen: read it again.
    useRefreshOnFocus(reload);

    const header = (
        <View>
            <View className="mb-3 flex-row flex-wrap items-center justify-between gap-2">
                <Text className="text-xl font-bold">Orders</Text>
                {isManager && scope?.kind === "event" && (
                    <Button
                        text="Print all completed sheets"
                        icon="fa-solid fa-print"
                        onClick={() => router.push(Paths.eventSheets(scope.eventId))}
                    />
                )}
            </View>

            {isManager && (
                <EventFilter
                    events={events}
                    allPicked={scope?.kind === "all"}
                    pickedEventId={scope?.kind === "event" ? scope.eventId : null}
                    showTerritory={showTerritory}
                    onPickAll={() => switchScope({ kind: "all" })}
                    onPickEvent={(eventId) => switchScope({ kind: "event", eventId })}
                    className="mb-3"
                />
            )}

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-3"
                contentContainerClassName="gap-2 pb-1"
            >
                {OrderStatusFilters.map((s) => (
                    <TabButton
                        key={s}
                        text={s === "All" ? "All" : OrderStatusLabels[s]}
                        active={statusFilter === s}
                        onClick={() => switchStatus(s)}
                    />
                ))}
            </ScrollView>

            <View className="mb-3 max-w-xl flex-row items-end gap-2">
                <TextField
                    label="Search"
                    value={search}
                    onChange={setSearch}
                    onSubmit={runSearch}
                    placeholder="Customer, rep, order #, phone or email"
                    className="flex-1"
                    autoCapitalize="none"
                />
                <Button
                    icon="fa-solid fa-magnifying-glass"
                    title="Search"
                    onClick={runSearch}
                    className="px-5"
                />
            </View>

            {loading && <ListSkeleton rows={6} />}
            {!loading && scope && orders.length > 0 && (
                <Text className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">
                    {SummarizeOrders(orders)}
                </Text>
            )}
            {!loading && !scope && (
                <View className="items-center rounded-xl border-2 border-dashed border-zinc-300 py-14 dark:border-zinc-700">
                    <Icon icon="fa-solid fa-calendar-xmark" className="text-3xl text-zinc-400" />
                    <Text className="mt-3 font-semibold">No active event</Text>
                    <Text className="mt-1 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        Orders for the current fundraiser show here once an event is active.
                    </Text>
                </View>
            )}
            {!loading && scope && orders.length === 0 && (
                <View className="items-center rounded-xl border-2 border-dashed border-zinc-300 py-14 dark:border-zinc-700">
                    <Icon icon="fa-solid fa-inbox" className="text-3xl text-zinc-400" />
                    <Text className="mt-3 font-semibold">No orders here</Text>
                    <Text className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        Nothing matches that filter.
                    </Text>
                </View>
            )}
        </View>
    );

    // Tap an order to see its sales sheet; Void, Reopen and Delete are a swipe away.
    const renderOrder = ({ item: order }: { item: OrderSummary }) => {
        const style = statusStyles[order.status ?? "Draft"];
        const actions: SwipeAction[] = [];
        if (isManager && CanVoidFromList(order))
            actions.push({
                label: "Void",
                icon: "fa-solid fa-ban",
                tone: "danger",
                onPress: () => setVoiding(order),
            });
        if (isManager && CanReopenFromList(order))
            actions.push({
                label: "Reopen",
                icon: "fa-solid fa-arrow-rotate-left",
                tone: "amber",
                onPress: () => setReopening(order),
            });
        if (isSystemAdmin)
            actions.push({
                label: "Delete",
                icon: "fa-solid fa-trash",
                tone: "danger",
                onPress: () => setRemoving(order),
            });

        return (
            <SwipeRow
                onPress={() => router.push(Paths.receipt(order.id!))}
                actions={actions}
                accessibilityLabel={`Order ${order.orderNumber}, ${order.billingName || "no name"}, ${
                    OrderStatusLabels[order.status ?? "Draft"]
                }, ${FormatCurrency(order.total)}. Opens the sales sheet`}
                containerClassName="mb-2"
                className="flex-row items-center gap-3 p-3"
            >
                <View className="h-12 min-w-[56px] items-center justify-center rounded-lg bg-zinc-100 px-1 dark:bg-zinc-700">
                    <Text className="text-sm font-bold">#{order.orderNumber}</Text>
                </View>

                <View className="min-w-0 flex-1">
                    <Text className="font-semibold">{order.billingName || "No name"}</Text>
                    <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                        {[
                            scope?.kind === "all" && showTerritory ? order.territoryName : null,
                            scope?.kind === "all" ? order.eventOrganization : null,
                            FormatShortDate(order.eventDate ?? order.createdAt),
                            order.cfsRepName,
                            `${order.itemCount ?? 0} item${(order.itemCount ?? 0) === 1 ? "" : "s"}`,
                            order.completedAt ? FormatTime(order.completedAt) : null,
                        ]
                            .filter(Boolean)
                            .join("  ·  ")}
                    </Text>
                </View>

                <View className="items-end gap-1">
                    <Text className="font-bold tabular-nums">{FormatCurrency(order.total)}</Text>
                    {(order.balanceDue ?? 0) > 0 && (
                        <Text className="text-xs text-amber-700 dark:text-amber-400">
                            {FormatCurrency(order.balanceDue)} due
                        </Text>
                    )}
                    <View className={cx("rounded-full px-2.5 py-1", style.box)}>
                        <Text className={cx("text-xs font-semibold", style.text)}>
                            {OrderStatusLabels[order.status ?? "Draft"]}
                        </Text>
                    </View>
                </View>

                <Icon icon="fa-solid fa-chevron-right" className="text-xs text-zinc-400" />
            </SwipeRow>
        );
    };

    return (
        <Page navbar scroll={false}>
            <FlatList
                data={loading || !scope ? [] : orders}
                keyExtractor={(order) => String(order.id)}
                renderItem={renderOrder}
                ListHeaderComponent={header}
                contentContainerClassName="mx-auto w-full max-w-screen-2xl p-3 pb-28 sm:p-4"
                keyboardShouldPersistTaps="handled"
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                }
            />

            {removing && (
                <ConfirmationModal
                    title={`Delete order #${removing.orderNumber}`}
                    message={DeleteOrderMessage(removing)}
                    confirmText="Delete for good"
                    confirmWord="DELETE"
                    destructive
                    onConfirm={handleRemove}
                    onCancel={() => setRemoving(null)}
                />
            )}

            {voiding && (
                <ConfirmationModal
                    title="Void order"
                    message={VoidOrderMessage(voiding)}
                    confirmText="Void"
                    destructive
                    onConfirm={handleVoid}
                    onCancel={() => setVoiding(null)}
                />
            )}

            {reopening && (
                <ReopenOrderModal
                    order={reopening}
                    onReopen={handleReopen}
                    onClose={() => setReopening(null)}
                />
            )}
        </Page>
    );
};

export default OrdersPage;
