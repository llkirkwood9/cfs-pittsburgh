import { useCallback, useEffect, useState } from "react";
import { Toast } from "@host";
import { useOrderEditor } from "./useOrderEditor";
import type { DeliveryOption } from "../Models/DeliveryOption";
import type { Event } from "../Models/Event";
import type { Order } from "../Models/Order";
import type { OrderSummary } from "../Models/OrderSummary";
import type { Product } from "../Models/Product";
import { GetDeliveryOptions } from "../Services/DeliveryOptionServices";
import { GetActiveEvent } from "../Services/EventServices";
import { AddOrder, DeleteOrder, GetDrafts, GetOrder, SubmitOrder } from "../Services/OrderServices";
import { GetProducts } from "../Services/ProductServices";
import { GetReps } from "../Services/UserServices";

/**
 * The sales floor: the active event, its catalog, the rep's open drafts and the one on screen.
 * Loads the active event, then its products, delivery options, reps and drafts, and opens the
 * first draft. Starting, discarding and sending a draft to checkout each read the drafts again
 * and open the first one left.
 * @param onDraftStarted Called when a new draft opens, so the screen can show its customer pane.
 * @returns The floor's state and handlers, with the open order's editor.
 */
export const useSalesFloor = (onDraftStarted: () => void) => {
    const [saleEvent, setSaleEvent] = useState<Event | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>([]);
    const [reps, setReps] = useState<string[]>([]);

    const [drafts, setDrafts] = useState<OrderSummary[]>([]);
    const [order, setOrder] = useState<Order | null>(null);

    const [loading, setLoading] = useState<boolean>(true);
    const [creating, setCreating] = useState<boolean>(false);
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [discardingDraft, setDiscardingDraft] = useState<boolean>(false);

    const refreshDrafts = useCallback(async (eventId: number) => {
        const list = await GetDrafts(eventId);
        setDrafts(list);
        return list;
    }, []);

    /** Reads the active event and everything for it, from scratch. */
    const load = useCallback(async () => {
        const active = await GetActiveEvent();
        setSaleEvent(active);
        // Drafts belong to their event, so a different event starts from its own.
        setDrafts([]);
        setOrder(null);

        if (!active?.id) return;

        const [catalog, options, repNames, draftList] = await Promise.all([
            GetProducts(),
            GetDeliveryOptions(),
            GetReps(),
            GetDrafts(active.id),
        ]);

        setProducts(catalog);
        setDeliveryOptions(options);
        setReps(repNames);
        setDrafts(draftList);

        if (draftList.length > 0 && draftList[0].id) {
            const first = await GetOrder(draftList[0].id);
            setOrder(first);
        }
    }, []);

    useEffect(() => {
        load().finally(() => setLoading(false));
    }, [load]);

    /**
     * Reads the drafts and stock counts again, keeping the open draft when it is still a draft -
     * or reads everything when there is no event.
     */
    const reloadDrafts = async () => {
        if (!saleEvent?.id) return load();
        const [list, catalog] = await Promise.all([refreshDrafts(saleEvent.id), GetProducts()]);
        if (catalog.length) setProducts(catalog);
        const keep = order?.id && list.some((d) => d.id === order.id) ? order.id : list[0]?.id;
        setOrder(keep ? await GetOrder(keep) : null);
    };

    /** Reads the drafts again and opens the first one left. */
    const openFirstDraft = async (eventId: number) => {
        const remaining = await refreshDrafts(eventId);
        setOrder(remaining[0]?.id ? await GetOrder(remaining[0].id) : null);
    };

    const editor = useOrderEditor(
        order,
        setOrder,
        async () => {
            if (saleEvent?.id) await refreshDrafts(saleEvent.id);
        },
        setProducts
    );

    const newDraft = async () => {
        if (!saleEvent?.id) return;

        setCreating(true);
        const created = await AddOrder(saleEvent.id);
        setCreating(false);

        if (!created) return;

        setOrder(created);
        onDraftStarted();
        await refreshDrafts(saleEvent.id);
        Toast.Success("Order started.");
    };

    const selectDraft = async (id: number) => {
        const selected = await GetOrder(id);
        if (selected) setOrder(selected);
    };

    const discardDraft = async () => {
        if (!order?.id || !saleEvent?.id) return;

        const success = await DeleteOrder(order.id);
        setDiscardingDraft(false);

        if (!success) return;

        await openFirstDraft(saleEvent.id);
        Toast.Success("Draft discarded.");
    };

    const sendToCheckout = async () => {
        if (!order?.id || !saleEvent?.id) return;

        setSubmitting(true);
        const result = await SubmitOrder(order.id);
        setSubmitting(false);

        if (!result) return;

        Toast.Success(`Order #${result.orderNumber} is with checkout. Send the customer over.`);
        await openFirstDraft(saleEvent.id);
    };

    return {
        saleEvent,
        products,
        deliveryOptions,
        reps,
        drafts,
        order,
        loading,
        load,
        reloadDrafts,
        creating,
        submitting,
        newDraft,
        selectDraft,
        discardingDraft,
        setDiscardingDraft,
        discardDraft,
        sendToCheckout,
        editor,
    };
};
