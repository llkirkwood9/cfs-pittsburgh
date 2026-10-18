import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import ReopenOrderModal from "../Components/Admin/ReopenOrderModal";
import Button from "../Components/Elements/Button";
import ConfirmationModal from "../Components/Elements/ConfirmationModal";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import TabButton from "../Components/Elements/TabButton";
import TextField from "../Components/Elements/TextField";
import { useAuth } from "../Context/AuthContext";
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

const statusStyles: Record<OrderStatus, string> = {
    Draft: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
    AwaitingCheckout: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
    Completed: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
    Voided: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
};

const statusLabels: Record<OrderStatus, string> = {
    Draft: "On the floor",
    AwaitingCheckout: "At checkout",
    Completed: "Completed",
    Voided: "Voided",
};

/**
 * A line over the list: how many orders it holds, what they come to and what is still owed.
 * Voided orders are listed but not counted in the money.
 */
const Summary = (orders: OrderSummary[]): string => {
    const live = orders.filter((o) => o.status !== "Voided");
    const total = live.reduce((sum, o) => sum + (o.total ?? 0), 0);
    const owed = live.reduce((sum, o) => sum + (o.balanceDue ?? 0), 0);
    return [
        `${orders.length} order${orders.length === 1 ? "" : "s"}`,
        `${FormatCurrency(total)} total`,
        owed > 0 ? `${FormatCurrency(owed)} still owed` : null,
    ]
        .filter(Boolean)
        .join(" · ");
};

/**
 * Past orders. Everyone can look back over the event they are working and open any sales sheet
 * for reprinting; an administrator can additionally search across every event that has ever run.
 */
const OrdersPage = () => {
    const { user, hasRole } = useAuth();
    const navigate = useNavigate();

    const isAdmin = hasRole("Admin");
    const isSystemAdmin = user?.role === "SystemAdmin";
    const [removing, setRemoving] = useState<OrderSummary | null>(null);

    const [events, setEvents] = useState<Event[]>([]);
    const [scope, setScope] = useState<Scope | null>(null);
    const [orders, setOrders] = useState<OrderSummary[]>([]);
    const [statusFilter, setStatusFilter] = useState<OrderStatus | "All">("All");
    const [search, setSearch] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(true);
    const [reopening, setReopening] = useState<OrderSummary | null>(null);

    const load = useCallback(async (target: Scope, status: OrderStatus | "All", term: string) => {
        setLoading(true);

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

        setLoading(false);
    }, []);

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

            const target: Scope = active?.id
                ? { kind: "event", eventId: active.id }
                : { kind: "all" };

            setScope(target);
            await load(target, "All", "");
        };

        boot();
    }, [isAdmin, load]);

    if (!user) return <Navigate to="/unauthorized" replace />;

    const switchScope = async (target: Scope) => {
        setScope(target);
        await load(target, statusFilter, search);
    };

    const switchStatus = async (status: OrderStatus | "All") => {
        setStatusFilter(status);
        if (scope) await load(scope, status, search);
    };

    const runSearch = async () => {
        if (scope) await load(scope, statusFilter, search);
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

    return (
        <div className="mx-auto max-w-(--breakpoint-2xl) p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-xl font-bold">Orders</h1>
                <div className="flex flex-wrap gap-2">
                    {isAdmin && scope?.kind === "event" && (
                        <Button
                            text="Print all completed sheets"
                            icon="fa-solid fa-print"
                            onClick={() =>
                                navigate(`/events/${scope.eventId}/sheets`, {
                                    state: { from: "/orders", label: "Back to orders" },
                                })
                            }
                        />
                    )}
                    <Button
                        text="Refresh"
                        icon="fa-solid fa-rotate"
                        onClick={runSearch}
                        className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                    />
                </div>
            </div>

            {isAdmin && (
                <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
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
                            onClick={() =>
                                event.id && switchScope({ kind: "event", eventId: event.id })
                            }
                        />
                    ))}
                </div>
            )}

            <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
                {(["All", "Completed", "AwaitingCheckout", "Draft", "Voided"] as const).map((s) => (
                    <TabButton
                        key={s}
                        text={s === "All" ? "All" : statusLabels[s]}
                        active={statusFilter === s}
                        onClick={() => switchStatus(s)}
                    />
                ))}
            </div>

            {/* A form, so Enter (or Go on a tablet keyboard) runs the search too. */}
            <form
                className="mb-3 flex max-w-xl items-end gap-2"
                onSubmit={(e) => {
                    e.preventDefault();
                    runSearch();
                }}
            >
                <TextField
                    label="Search"
                    value={search}
                    onChange={setSearch}
                    placeholder="Customer, rep, order #, phone or email"
                    className="flex-1"
                />
                <Button
                    icon="fa-solid fa-magnifying-glass"
                    type="submit"
                    title="Search"
                    className="px-5"
                />
            </form>

            {!loading && scope && orders.length > 0 && (
                <p className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">{Summary(orders)}</p>
            )}

            {loading ? (
                <ListSkeleton rows={6} />
            ) : !scope ? (
                <div className="rounded-xl border-2 border-dashed border-zinc-300 py-14 text-center dark:border-zinc-700">
                    <Icon icon="fa-solid fa-calendar-xmark" className="text-3xl text-zinc-400" />
                    <p className="mt-3 text-base font-semibold">No active event</p>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        Orders for the current fundraiser show here once an event is active.
                    </p>
                </div>
            ) : orders.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-zinc-300 py-14 text-center dark:border-zinc-700">
                    <Icon icon="fa-solid fa-inbox" className="text-3xl text-zinc-400" />
                    <p className="mt-3 text-base font-semibold">No orders here</p>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        Nothing matches that filter.
                    </p>
                </div>
            ) : (
                <ul className="space-y-2">
                    {orders.map((order) => (
                        <li
                            key={order.id}
                            className="flex flex-col gap-2 rounded-xl bg-white p-3 shadow-xs sm:flex-row sm:items-center sm:gap-3 dark:bg-zinc-800"
                        >
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                                <span
                                    className="flex h-12 w-14 shrink-0 items-center justify-center rounded-lg
                                bg-zinc-100 text-sm font-bold dark:bg-zinc-700"
                                >
                                    #{order.orderNumber}
                                </span>

                                <div className="min-w-0 flex-1">
                                    <p className="wrap-break-word font-semibold">
                                        {order.billingName || "No name"}
                                    </p>
                                    <p className="flex flex-wrap gap-x-2 text-xs text-zinc-500 dark:text-zinc-400">
                                        {scope?.kind === "all" && order.eventOrganization && (
                                            <span className="font-medium text-zinc-600 dark:text-zinc-300">
                                                {order.eventOrganization}
                                            </span>
                                        )}
                                        <span>
                                            {FormatShortDate(order.eventDate ?? order.createdAt)}
                                        </span>
                                        {order.cfsRepName && <span>{order.cfsRepName}</span>}
                                        <span>
                                            {order.itemCount ?? 0} item
                                            {(order.itemCount ?? 0) === 1 ? "" : "s"}
                                        </span>
                                        {order.completedAt && (
                                            <span>{FormatTime(order.completedAt)}</span>
                                        )}
                                    </p>
                                </div>

                                <div className="shrink-0 text-right">
                                    <p className="font-bold tabular-nums">
                                        {FormatCurrency(order.total)}
                                    </p>
                                    {(order.balanceDue ?? 0) > 0 && (
                                        <p className="text-xs text-amber-700 dark:text-amber-400">
                                            {FormatCurrency(order.balanceDue)} due
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-end gap-2">
                                <span
                                    className={`mr-auto shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold sm:mr-0 ${
                                        statusStyles[order.status ?? "Draft"]
                                    }`}
                                >
                                    {statusLabels[order.status ?? "Draft"]}
                                </span>

                                <Button
                                    text="Sales sheet"
                                    icon="fa-solid fa-file-lines"
                                    onClick={() =>
                                        navigate(`/receipt/${order.id}`, {
                                            state: { from: "/orders", label: "Back to orders" },
                                        })
                                    }
                                    className="min-h-[44px] px-3 text-sm"
                                />
                                {isAdmin &&
                                    (order.status === "Completed" ||
                                        order.status === "AwaitingCheckout") && (
                                        <Button
                                            text="Reopen"
                                            icon="fa-solid fa-arrow-rotate-left"
                                            onClick={() => setReopening(order)}
                                            className="min-h-[44px] bg-amber-600 px-3 text-sm hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700"
                                        />
                                    )}
                                {isSystemAdmin && (
                                    <button
                                        type="button"
                                        onClick={() => setRemoving(order)}
                                        aria-label="Delete order permanently"
                                        title="Delete permanently"
                                        className="flex h-11 w-11 items-center justify-center rounded-lg text-red-700
                                            hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-950/40"
                                    >
                                        <Icon icon="fa-solid fa-trash" />
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}

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
        </div>
    );
};

export default OrdersPage;
