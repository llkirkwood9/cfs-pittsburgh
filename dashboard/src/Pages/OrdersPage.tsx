import { useNavigate } from "react-router-dom";
import ReopenOrderModal from "../Components/Admin/ReopenOrderModal";
import EventFilter from "../Components/Dashboard/EventFilter";
import Button from "../Components/Elements/Button";
import ConfirmationModal from "../Components/Elements/ConfirmationModal";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import TabButton from "../Components/Elements/TabButton";
import TextField from "../Components/Elements/TextField";
import { useTerritory } from "@shared/Context/TerritoryContext";
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
import { Paths, ScreenLinks } from "../Lib/ScreenLinks";

const statusStyles: Record<OrderStatus, string> = {
    Draft: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
    AwaitingCheckout: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
    Completed: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
    Voided: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
};

/**
 * Past orders. Everyone can look back over the event they are working and open any sales sheet
 * for reprinting; a manager or above can additionally search across every event in their
 * territories (a system admin or administrator, every territory). With more than one territory in
 * view, each event says which territory it's in.
 */
const OrdersPage = () => {
    const { viewingAll: showTerritory } = useTerritory();
    const navigate = useNavigate();
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
    } = useOrders();

    // Viewing every territory, each order says which one it came from.

    return (
        <div className="mx-auto max-w-(--breakpoint-2xl) p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-xl font-bold">Orders</h1>
                <div className="flex flex-wrap gap-2">
                    {isManager && scope?.kind === "event" && (
                        <Button
                            text="Print all completed sheets"
                            icon="fa-solid fa-print"
                            onClick={() =>
                                navigate(Paths.eventSheets(scope.eventId), {
                                    state: {
                                        from: ScreenLinks.orders.path,
                                        label: "Back to orders",
                                    },
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

            <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
                {OrderStatusFilters.map((s) => (
                    <TabButton
                        key={s}
                        text={s === "All" ? "All" : OrderStatusLabels[s]}
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
                <p className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">
                    {SummarizeOrders(orders)}
                </p>
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
                                        {scope?.kind === "all" &&
                                            showTerritory &&
                                            order.territoryName && (
                                                <span className="font-medium text-sky-700 dark:text-sky-400">
                                                    {order.territoryName}
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
                                    {OrderStatusLabels[order.status ?? "Draft"]}
                                </span>

                                <Button
                                    text="Sales sheet"
                                    icon="fa-solid fa-file-lines"
                                    onClick={() =>
                                        navigate(Paths.receipt(order.id!), {
                                            state: {
                                                from: ScreenLinks.orders.path,
                                                label: "Back to orders",
                                            },
                                        })
                                    }
                                    className="min-h-[44px] px-3 text-sm"
                                />
                                {isManager && CanVoidFromList(order) && (
                                    <Button
                                        text="Void"
                                        icon="fa-solid fa-ban"
                                        onClick={() => setVoiding(order)}
                                        className="min-h-[44px] bg-red-700 px-3 text-sm hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700"
                                    />
                                )}
                                {isManager && CanReopenFromList(order) && (
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
        </div>
    );
};

export default OrdersPage;
