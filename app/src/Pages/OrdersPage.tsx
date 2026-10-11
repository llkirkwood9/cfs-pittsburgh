import { Redirect, router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, View } from "react-native";
import ReopenOrderModal from "../Components/Admin/ReopenOrderModal";
import Button from "../Components/Elements/Button";
import ConfirmationModal from "../Components/Elements/ConfirmationModal";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import Page from "../Components/Elements/Page";
import TabButton from "../Components/Elements/TabButton";
import Text from "../Components/Elements/Text";
import TextField from "../Components/Elements/TextField";
import { useAuth } from "../Context/AuthContext";
import { useBreakpoint } from "../Hooks/UseBreakpoint";
import { cx } from "../Lib/ClassNames";
import {
    EventsForFilter,
    FormatCurrency,
    FormatShortDate,
    FormatTime,
    IsPastEvent,
} from "../Lib/ModelHelpers";
import { Toast } from "../Lib/Toast";
import type { Event } from "../Models/Event";
import type { OrderStatus } from "../Models/Order";
import type { OrderSummary } from "../Models/OrderSummary";
import { GetActiveEvent, GetEvents } from "../Services/EventServices";
import {
    DeleteOrder,
    GetAllOrders,
    GetOrdersForEvent,
    ReopenOrder,
} from "../Services/OrderServices";

type Scope = { kind: "event"; eventId: number } | { kind: "all" };

const statusStyles: Record<OrderStatus, { box: string; text: string }> = {
    Draft: { box: "bg-zinc-200 dark:bg-zinc-700", text: "text-zinc-700 dark:text-zinc-200" },
    AwaitingCheckout: {
        box: "bg-amber-100 dark:bg-amber-900/50",
        text: "text-amber-800 dark:text-amber-300",
    },
    Completed: { box: "bg-green-100 dark:bg-green-900/50", text: "text-green-800 dark:text-green-300" },
    Voided: { box: "bg-red-100 dark:bg-red-900/50", text: "text-red-800 dark:text-red-300" },
};

const statusLabels: Record<OrderStatus, string> = {
    Draft: "On the floor",
    AwaitingCheckout: "At checkout",
    Completed: "Completed",
    Voided: "Voided",
};

/**
 * Past orders. Everyone can look back over the event they are working and open any sales sheet
 * for reprinting; an administrator can additionally search across every event that has ever run.
 */
const OrdersPage = () => {
    const { user, hasRole } = useAuth();
    const { sm } = useBreakpoint();

    const isAdmin = hasRole("Admin");
    const isSystemAdmin = user?.role === "SystemAdmin";
    const [removing, setRemoving] = useState<OrderSummary | null>(null);

    const [events, setEvents] = useState<Event[]>([]);
    const [scope, setScope] = useState<Scope | null>(null);
    const [orders, setOrders] = useState<OrderSummary[]>([]);
    const [statusFilter, setStatusFilter] = useState<OrderStatus | "All">("All");
    const [search, setSearch] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [reopening, setReopening] = useState<OrderSummary | null>(null);

    const load = useCallback(async (target: Scope, status: OrderStatus | "All", term: string) => {
        const rows =
            target.kind === "all"
                ? await GetAllOrders({
                      status: status === "All" ? undefined : status,
                      search: term,
                  })
                : await GetOrdersForEvent(target.eventId, status === "All" ? undefined : status);

        // The per-event endpoint has no search of its own, so narrow it here rather than
        // making every caller pay for a query parameter only this page uses.
        // A phone number matches on its digits alone, however it was typed or stored.
        const term_ = term.trim().toLowerCase();
        const digits = term_.replace(/\D/g, "");
        const phoneMatch = (value?: string | null) =>
            digits.length >= 4 && (value ?? "").replace(/\D/g, "").includes(digits);
        setOrders(
            term_ && target.kind === "event"
                ? rows.filter(
                      (o) =>
                          (o.billingName ?? "").toLowerCase().includes(term_) ||
                          (o.cfsRepName ?? "").toLowerCase().includes(term_) ||
                          (o.billingEmail ?? "").toLowerCase().includes(term_) ||
                          String(o.orderNumber ?? "").includes(term_) ||
                          phoneMatch(o.billingCell) ||
                          phoneMatch(o.billingAlt)
                  )
                : rows
        );
    }, []);

    const loadWith = useCallback(
        async (target: Scope, status: OrderStatus | "All", term: string) => {
            setLoading(true);
            await load(target, status, term);
            setLoading(false);
        },
        [load]
    );

    useEffect(() => {
        const boot = async () => {
            const [list, active] = await Promise.all([
                isAdmin ? GetEvents() : Promise.resolve([]),
                GetActiveEvent(),
            ]);

            setEvents(EventsForFilter(list));

            // Between fundraisers there is no active event. An admin falls back to every event;
            // everyone else has nothing current to show, and all-events history is admin-only.
            if (!active?.id && !isAdmin) {
                setScope(null);
                setLoading(false);
                return;
            }

            const target: Scope = active?.id ? { kind: "event", eventId: active.id } : { kind: "all" };

            setScope(target);
            await loadWith(target, "All", "");
        };

        boot();
    }, [isAdmin, loadWith]);

    if (!user) return <Redirect href="/unauthorized" />;

    const switchScope = async (target: Scope) => {
        setScope(target);
        await loadWith(target, statusFilter, search);
    };

    const switchStatus = async (status: OrderStatus | "All") => {
        setStatusFilter(status);
        if (scope) await loadWith(scope, status, search);
    };

    const runSearch = async () => {
        if (scope) await loadWith(scope, statusFilter, search);
    };

    const handleRefresh = async () => {
        if (!scope) return;
        setRefreshing(true);
        await load(scope, statusFilter, search);
        setRefreshing(false);
    };

    const handleReopen = async (to: "floor" | "checkout") => {
        if (!reopening?.id) return;

        const result = await ReopenOrder(reopening.id, to);
        if (!result) return;

        setReopening(null);
        Toast.Success(
            `Order #${result.orderNumber} sent ${to === "checkout" ? "to checkout" : "to the sales floor"}.`
        );
        await runSearch();
    };

    const header = (
        <View>
            <View className="mb-3 flex-row flex-wrap items-center justify-between gap-2">
                <Text className="text-xl font-bold">Orders</Text>
                {isAdmin && scope?.kind === "event" && (
                    <Button
                        text="Print all completed sheets"
                        icon="fa-solid fa-print"
                        onClick={() =>
                            router.push({
                                pathname: "/events/[eventId]/sheets",
                                params: { eventId: String(scope.eventId) },
                            })
                        }
                    />
                )}
            </View>

            {isAdmin && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="mb-3"
                    contentContainerClassName="gap-2 pb-1"
                >
                    <TabButton
                        text="All events"
                        active={scope?.kind === "all"}
                        onClick={() => switchScope({ kind: "all" })}
                    />
                    {events.map((event) => (
                        <TabButton
                            key={event.id}
                            text={event.organization ?? ""}
                            tag={IsPastEvent(event) ? "Past" : undefined}
                            active={scope?.kind === "event" && scope.eventId === event.id}
                            onClick={() => event.id && switchScope({ kind: "event", eventId: event.id })}
                        />
                    ))}
                </ScrollView>
            )}

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-3"
                contentContainerClassName="gap-2 pb-1"
            >
                {(["All", "Completed", "AwaitingCheckout", "Draft", "Voided"] as const).map((s) => (
                    <TabButton
                        key={s}
                        text={s === "All" ? "All" : statusLabels[s]}
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
                <Button icon="fa-solid fa-magnifying-glass" title="Search" onClick={runSearch} className="px-5" />
            </View>

            {loading && <ListSkeleton rows={6} />}
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

    const renderOrder = ({ item: order }: { item: OrderSummary }) => {
        const style = statusStyles[order.status ?? "Draft"];
        return (
            <View
                className={cx(
                    "mb-2 gap-2 rounded-xl bg-white p-3 raised-sm dark:bg-zinc-800",
                    sm && "flex-row items-center gap-3"
                )}
            >
                <View className="min-w-0 flex-1 flex-row items-center gap-3">
                    <View className="h-12 min-w-[56px] items-center justify-center rounded-lg bg-zinc-100 px-1 dark:bg-zinc-700">
                        <Text className="text-sm font-bold">#{order.orderNumber}</Text>
                    </View>

                    <View className="min-w-0 flex-1">
                        <Text className="font-semibold">{order.billingName || "No name"}</Text>
                        <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                            {[
                                scope?.kind === "all" ? order.eventOrganization : null,
                                FormatShortDate(order.eventDate ?? order.createdAt),
                                order.cfsRepName,
                                `${order.lineCount ?? 0} item${(order.lineCount ?? 0) === 1 ? "" : "s"}`,
                                order.completedAt ? FormatTime(order.completedAt) : null,
                            ]
                                .filter(Boolean)
                                .join("  ·  ")}
                        </Text>
                    </View>

                    <View className="items-end">
                        <Text className="font-bold tabular-nums">{FormatCurrency(order.total)}</Text>
                        {(order.balanceDue ?? 0) > 0 && (
                            <Text className="text-xs text-amber-700 dark:text-amber-400">
                                {FormatCurrency(order.balanceDue)} due
                            </Text>
                        )}
                    </View>
                </View>

                <View className="flex-row flex-wrap items-center justify-end gap-2">
                    <View className={cx("rounded-full px-2.5 py-1", style.box, !sm && "mr-auto")}>
                        <Text className={cx("text-xs font-semibold", style.text)}>
                            {statusLabels[order.status ?? "Draft"]}
                        </Text>
                    </View>

                    <Button
                        text="Sales sheet"
                        icon="fa-solid fa-file-lines"
                        onClick={() =>
                            router.push({
                                pathname: "/receipt/[orderId]",
                                params: { orderId: String(order.id) },
                            })
                        }
                        className="min-h-[44px] px-3 text-sm"
                    />
                    {isAdmin && (order.status === "Completed" || order.status === "AwaitingCheckout") && (
                        <Button
                            text="Reopen"
                            icon="fa-solid fa-arrow-rotate-left"
                            onClick={() => setReopening(order)}
                            className="min-h-[44px] bg-amber-600 px-3 text-sm dark:bg-amber-600"
                        />
                    )}
                    {isSystemAdmin && (
                        <Pressable
                            onPress={() => setRemoving(order)}
                            accessibilityRole="button"
                            accessibilityLabel="Delete order permanently"
                            className="h-11 w-11 items-center justify-center rounded-lg active:bg-red-100 dark:active:bg-red-950/40"
                        >
                            <Icon icon="fa-solid fa-trash" className="text-red-700 dark:text-red-400" />
                        </Pressable>
                    )}
                </View>
            </View>
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
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            />

            {removing && (
                <ConfirmationModal
                    title={`Delete order #${removing.orderNumber}`}
                    message={`Permanently delete order #${removing.orderNumber}${
                        removing.billingName ? ` for ${removing.billingName}` : ""
                    }, with its items and payments? It comes off every total and its sales sheet is gone. Stock that went home is not put back - reopen or void the sale first if it should be. This cannot be undone.`}
                    confirmText="Delete for good"
                    confirmWord="DELETE"
                    destructive
                    onConfirm={async () => {
                        const id = removing.id;
                        setRemoving(null);
                        if (id && (await DeleteOrder(id, true))) {
                            Toast.Success(`Order #${removing.orderNumber} deleted.`);
                            if (scope) await load(scope, statusFilter, search);
                        }
                    }}
                    onCancel={() => setRemoving(null)}
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
