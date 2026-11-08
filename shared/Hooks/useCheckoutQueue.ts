import { useCallback, useEffect, useRef, useState } from "react";
import { Toast } from "@host";
import { useOrderEditor } from "./useOrderEditor";
import { CheckoutQueueCounted } from "../Lib/CheckoutWaiting";
import { ClosedElsewhereText } from "../Lib/Checkout";
import { IsOnline } from "../Lib/Connection";
import type { DeliveryOption } from "../Models/DeliveryOption";
import type { Event } from "../Models/Event";
import type { Order } from "../Models/Order";
import type { OrderSummary } from "../Models/OrderSummary";
import type { Product } from "../Models/Product";
import { GetDeliveryOptions } from "../Services/DeliveryOptionServices";
import { GetActiveEvent } from "../Services/EventServices";
import {
    CompleteOrder,
    GetCheckoutQueue,
    GetOrder,
    ReopenOrder,
    VoidOrder,
} from "../Services/OrderServices";
import { GetProducts } from "../Services/ProductServices";

/**
 * How often the queue re-polls, so a new hand-off shows up without anyone refreshing. It also
 * keeps the Checkout tab's count current while this screen is open.
 */
const POLL_MS = 5000;

/**
 * The checkout table: the active event, the queue of orders waiting to pay and the one on
 * screen. Opens the order asked for, or the first in the queue; polls the queue; and closes the
 * order on screen when another device completes, voids or sends it back.
 * @param orderId The order the screen was opened on, if any.
 * @returns The table's state and handlers, with the open order's editor.
 */
export const useCheckoutQueue = (orderId?: number) => {
    const [saleEvent, setSaleEvent] = useState<Event | null>(null);
    const [queue, setQueue] = useState<OrderSummary[]>([]);
    const [order, setOrder] = useState<Order | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [completing, setCompleting] = useState<boolean>(false);
    const [voiding, setVoiding] = useState<boolean>(false);
    // Orders this device is completing, voiding or sending back, so the check below doesn't take
    // its own work for someone else's.
    const closedHere = useRef<Set<number>>(new Set());

    const refreshQueue = useCallback(async (eventId: number) => {
        const list = await GetCheckoutQueue(eventId);
        setQueue(list);
        if (IsOnline()) CheckoutQueueCounted(list.length);
        return list;
    }, []);

    const openOrder = useCallback(async (id: number) => {
        const loaded = await GetOrder(id);
        if (loaded) setOrder(loaded);
    }, []);

    /** Reads the active event and everything for it, from scratch. */
    const load = useCallback(async () => {
        const active = await GetActiveEvent();
        setSaleEvent(active);

        if (!active?.id) {
            setQueue([]);
            setOrder(null);
            return;
        }

        const [list, catalog, options] = await Promise.all([
            refreshQueue(active.id),
            GetProducts(),
            GetDeliveryOptions(),
        ]);

        setProducts(catalog);
        setDeliveryOptions(options);

        if (orderId) await openOrder(orderId);
        else if (list[0]?.id) await openOrder(list[0].id);
        else setOrder(null);
    }, [orderId, openOrder, refreshQueue]);

    useEffect(() => {
        setLoading(true);
        load().finally(() => setLoading(false));
    }, [load]);

    useEffect(() => {
        if (!saleEvent?.id) return;

        const timer = setInterval(() => {
            // A poll that fails while the Wi-Fi is down keeps the queue on screen rather than
            // emptying it.
            GetCheckoutQueue(saleEvent.id!).then((list) => {
                if (!IsOnline()) return;
                setQueue(list);
                CheckoutQueueCounted(list.length);
            });
        }, POLL_MS);

        return () => clearInterval(timer);
    }, [saleEvent?.id]);

    // Someone else may finish the order on screen - complete or void it at another device, or
    // send it back to the floor. Once it drops out of the queue, look it up and close it here too,
    // so nobody keeps working on a sale that is already done.
    useEffect(() => {
        if (!order?.id || order.status !== "AwaitingCheckout") return;
        if (queue.some((o) => o.id === order.id) || closedHere.current.has(order.id)) return;

        let cancelled = false;
        GetOrder(order.id).then((latest) => {
            if (cancelled || !IsOnline() || latest?.status === "AwaitingCheckout") return;
            Toast.Info(ClosedElsewhereText(order.orderNumber, latest?.status));
            setOrder(null);
        });
        return () => {
            cancelled = true;
        };
    }, [queue, order?.id, order?.status, order?.orderNumber]);

    /** Reads the queue and the open order again - or everything when there is no event. */
    const reloadQueue = async () => {
        if (!saleEvent?.id) return load();
        await refreshQueue(saleEvent.id);
        if (order?.id) await openOrder(order.id);
    };

    /** Reads the queue again and opens the first order in it. */
    const advance = async () => {
        if (!saleEvent?.id) return;
        const list = await refreshQueue(saleEvent.id);
        setOrder(list[0]?.id ? await GetOrder(list[0].id) : null);
    };

    const editor = useOrderEditor(
        order,
        setOrder,
        async () => {
            if (saleEvent?.id) await refreshQueue(saleEvent.id);
        },
        setProducts
    );

    /**
     * Runs one of the actions that closes the order on screen here, so the check above doesn't
     * report it as closed elsewhere.
     * @param action The action.
     * @returns Its result.
     */
    const closeHere = async (action: (id: number) => Promise<Order | null>) => {
        if (!order?.id) return null;
        const closing = order.id;
        closedHere.current.add(closing);
        const result = await action(closing);
        if (!result?.id) closedHere.current.delete(closing);
        return result?.id ? result : null;
    };

    /**
     * Completes the sale on screen.
     * @returns The completed order, for the screen to open its receipt; null when it failed.
     */
    const complete = async () => {
        setCompleting(true);
        const result = await closeHere(CompleteOrder);
        setCompleting(false);
        if (result) Toast.Success(`Order #${result.orderNumber} completed.`);
        return result;
    };

    const sendBack = async () => {
        const result = await closeHere((id) => ReopenOrder(id));
        if (!result) return;
        Toast.Info(`Order #${result.orderNumber} sent back to the floor.`);
        await advance();
    };

    const voidOrder = async () => {
        const result = await closeHere(VoidOrder);
        setVoiding(false);
        if (!result) return;
        Toast.Info(`Order #${result.orderNumber} voided.`);
        await advance();
    };

    return {
        saleEvent,
        queue,
        order,
        products,
        deliveryOptions,
        loading,
        load,
        reloadQueue,
        openOrder,
        advance,
        completing,
        complete,
        sendBack,
        voiding,
        setVoiding,
        voidOrder,
        editor,
    };
};
