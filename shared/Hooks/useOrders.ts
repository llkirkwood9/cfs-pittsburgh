import { useCallback, useEffect, useState } from "react";
import { Toast } from "@host";
import { useAuth } from "../Context/AuthContext";
import { FilterOrders, StartingOrderScope } from "../Lib/OrderList";
import type { OrderScope, OrderStatusFilter } from "../Lib/OrderList";
import type { OrderSummary } from "../Models/OrderSummary";
import {
    DeleteOrder,
    GetAllOrders,
    GetOrdersForEvent,
    ReopenOrder,
    VoidOrder,
} from "../Services/OrderServices";
import { useEventFilter } from "./useEventFilter";

/**
 * The Orders screen: which orders are listed (event, status, search), and voiding, reopening and
 * deleting one.
 * @returns The screen's state and handlers.
 */
export const useOrders = () => {
    const { hasRole } = useAuth();
    const isManager = hasRole("Manager");
    const isSystemAdmin = hasRole("SystemAdmin");
    const { events, activeId, loadEvents } = useEventFilter(isManager);

    const [scope, setScope] = useState<OrderScope | null>(null);
    const [orders, setOrders] = useState<OrderSummary[]>([]);
    const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>("All");
    const [search, setSearch] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(true);
    const [reopening, setReopening] = useState<OrderSummary | null>(null);
    const [voiding, setVoiding] = useState<OrderSummary | null>(null);
    const [removing, setRemoving] = useState<OrderSummary | null>(null);

    /** Reads the list without showing it loading. */
    const fetchOrders = useCallback(
        async (target: OrderScope, status: OrderStatusFilter, term: string) => {
            const rows =
                target.kind === "all"
                    ? await GetAllOrders({
                          status: status === "All" ? undefined : status,
                          search: term,
                      })
                    : await GetOrdersForEvent(
                          target.eventId,
                          status === "All" ? undefined : status
                      );

            // The per-event endpoint has no search of its own, so narrow it here rather than
            // making every caller pay for a query parameter only this page uses.
            setOrders(target.kind === "event" ? FilterOrders(rows ?? [], term) : (rows ?? []));
        },
        []
    );

    const loadWith = useCallback(
        async (target: OrderScope, status: OrderStatusFilter, term: string) => {
            setLoading(true);
            await fetchOrders(target, status, term);
            setLoading(false);
        },
        [fetchOrders]
    );

    /** Starts the screen: the events, and the active event's orders. */
    const boot = useCallback(async () => {
        const { active } = await loadEvents();
        const target = StartingOrderScope(active, isManager);
        setScope(target);
        if (!target) {
            setOrders([]);
            setLoading(false);
            return;
        }
        await loadWith(target, "All", "");
    }, [isManager, loadEvents, loadWith]);

    useEffect(() => {
        boot();
    }, [boot]);

    const switchScope = async (target: OrderScope) => {
        setScope(target);
        await loadWith(target, statusFilter, search);
    };

    const switchStatus = async (status: OrderStatusFilter) => {
        setStatusFilter(status);
        if (scope) await loadWith(scope, status, search);
    };

    const runSearch = async () => {
        if (scope) await loadWith(scope, statusFilter, search);
    };

    /** The same list, read again quietly. */
    const refresh = async () => {
        if (scope) await fetchOrders(scope, statusFilter, search);
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

    const handleVoid = async () => {
        if (!voiding?.id) return;

        const id = voiding.id;
        setVoiding(null);
        const result = await VoidOrder(id);
        if (!result) return;

        Toast.Info(`Order #${result.orderNumber} voided.`);
        await runSearch();
    };

    // System admin only: delete the order for good.
    const handleRemove = async () => {
        if (!removing) return;
        const { id, orderNumber } = removing;
        setRemoving(null);
        if (id && (await DeleteOrder(id, true))) {
            Toast.Success(`Order #${orderNumber} deleted.`);
            await refresh();
        }
    };

    return {
        isManager,
        isSystemAdmin,
        events,
        activeId,
        boot,
        scope,
        orders,
        statusFilter,
        search,
        setSearch,
        loading,
        switchScope,
        switchStatus,
        runSearch,
        refresh,
        reopening,
        setReopening,
        handleReopen,
        voiding,
        setVoiding,
        handleVoid,
        removing,
        setRemoving,
        handleRemove,
    };
};
