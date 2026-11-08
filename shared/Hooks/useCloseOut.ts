import { useCallback, useEffect, useState } from "react";
import { Toast } from "@host";
import { useAuth } from "../Context/AuthContext";
import {
    ClearAll,
    ClearOne,
    CloseOutSteps,
    SummarizeCloseOut,
    VoidsWhenCleared,
} from "../Lib/CloseOut";
import type { Clearing } from "../Lib/CloseOut";
import type { Event } from "../Models/Event";
import type { InventoryItem } from "../Models/InventoryItem";
import type { OrderSummary } from "../Models/OrderSummary";
import { GetEvent, UpdateEvent } from "../Services/EventServices";
import { GetInventory } from "../Services/InventoryServices";
import { DeleteOrder, GetOrdersForEvent, VoidOrder } from "../Services/OrderServices";

/**
 * The event close-out screen: the event, its orders and stock, the checklist, clearing open
 * orders and closing the event.
 * @param id The event's id.
 * @returns The screen's state and handlers.
 */
export const useCloseOut = (id: number) => {
    const { hasRole } = useAuth();
    // Managers and above can clear open orders: discard a draft with nothing paid, void the rest.
    const canClear = hasRole("Manager");

    const [saleEvent, setSaleEvent] = useState<Event | null>(null);
    const [orders, setOrders] = useState<OrderSummary[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [confirming, setConfirming] = useState<boolean>(false);
    const [closing, setClosing] = useState<boolean>(false);
    const [clearing, setClearing] = useState<Clearing | null>(null);
    const [working, setWorking] = useState<boolean>(false);

    const load = useCallback(async () => {
        if (!id) return setLoading(false);
        const [found, list, stock] = await Promise.all([
            GetEvent(id),
            GetOrdersForEvent(id),
            GetInventory(id),
        ]);
        setSaleEvent(found);
        setOrders(list);
        setInventory(stock);
        setLoading(false);
    }, [id]);

    useEffect(() => {
        load();
    }, [load]);

    const summary = SummarizeCloseOut(orders, inventory);
    const active = Boolean(saleEvent?.isActive);
    const steps = CloseOutSteps(summary, active);
    const blocking = steps.filter((s) => !s.done && !s.optional);

    /**
     * Discards or voids the given orders, then reads the list again.
     * @param list The orders.
     */
    const clearOrders = async (list: OrderSummary[]) => {
        setWorking(true);
        let done = 0;
        for (const o of list) {
            if (!o.id) continue;
            const ok = VoidsWhenCleared(o)
                ? Boolean(await VoidOrder(o.id))
                : await DeleteOrder(o.id);
            if (ok) done += 1;
        }
        setOrders(await GetOrdersForEvent(id));
        setWorking(false);
        if (done) Toast.Success(`${done} order${done === 1 ? "" : "s"} cleared.`);
    };

    /**
     * Closes the event so nothing more is sold under it.
     * @param onClosed Called once it's closed, to leave the screen.
     */
    const closeEvent = async (onClosed: () => void) => {
        if (!saleEvent) return;
        setClosing(true);
        const saved = await UpdateEvent({ id: saleEvent.id, isActive: false });
        setClosing(false);
        setConfirming(false);
        if (!saved) return;
        Toast.Success(`${saleEvent.organization} is closed.`);
        onClosed();
    };

    return {
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
        /** Asks before discarding or voiding one open order. */
        askOne: (o: OrderSummary) => setClearing(ClearOne(o)),
        /** Asks before clearing every order in a list in one step. */
        askAll: (list: OrderSummary[], what: string) => setClearing(ClearAll(list, what)),
        working,
        clearOrders,
    };
};
