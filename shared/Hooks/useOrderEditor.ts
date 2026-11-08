import { useState } from "react";
import type { Order } from "../Models/Order";
import type { OrderLine } from "../Models/OrderLine";
import type { OrderPayment, PaymentMethod } from "../Models/OrderPayment";
import type { Product } from "../Models/Product";
import {
    AddOrderLine,
    AddOrderPayment,
    DeleteOrderLine,
    DeleteOrderPayment,
    ReorderOrderLines,
    UpdateOrder,
    UpdateOrderLine,
} from "../Services/OrderServices";
import { GetProducts } from "../Services/ProductServices";

/**
 * Changes to the open order, shared by the sales floor and the checkout table. Every change
 * returns the recalculated order, so state and totals stay in lockstep; the list beside it (the
 * drafts, or the checkout queue) is read again after each one. Also keeps the line being edited,
 * given a service or an upcharge, or removed, for the screen's modals.
 * @param order The open order.
 * @param setOrder Replaces the open order.
 * @param refreshList Reads the drafts or the queue again after a change.
 * @param setProducts Replaces the catalog, when the item picker opens on fresh stock counts.
 * @returns The handlers and the modals' state.
 */
export const useOrderEditor = (
    order: Order | null,
    setOrder: (order: Order) => void,
    refreshList: () => Promise<unknown>,
    setProducts: (products: Product[]) => void
) => {
    const [showAddItem, setShowAddItem] = useState<boolean>(false);
    const [editingLine, setEditingLine] = useState<OrderLine | null>(null);
    const [servicingLine, setServicingLine] = useState<OrderLine | null>(null);
    const [upchargingLine, setUpchargingLine] = useState<OrderLine | null>(null);
    const [removingLine, setRemovingLine] = useState<OrderLine | null>(null);

    const applyResult = async (result: Order | null) => {
        if (!result) return;
        setOrder(result);
        await refreshList();
    };

    const saveOrder = async (changes: Order) => {
        if (!order?.id) return;
        await applyResult(await UpdateOrder({ ...changes, id: order.id }));
    };

    const addLine = async (line: OrderLine) => {
        if (!order?.id) return;
        await applyResult(await AddOrderLine(order.id, line));
    };

    const reorderLines = async (itemIds: number[]) => {
        if (!order?.id) return;
        await applyResult(await ReorderOrderLines(order.id, itemIds));
    };

    const updateLine = async (line: OrderLine) => {
        await applyResult(await UpdateOrderLine(line));
    };

    /** Changes a line's quantity in place. */
    const changeQuantity = (line: OrderLine, quantity: number) =>
        updateLine({ id: line.id, quantity });

    /** Removes the line the rep confirmed. */
    const removeLine = async () => {
        if (!removingLine?.id) return;
        const result = await DeleteOrderLine(removingLine.id);
        setRemovingLine(null);
        await applyResult(result);
    };

    const addPayment = async (payment: OrderPayment) => {
        if (!order?.id) return;
        await applyResult(await AddOrderPayment(order.id, payment));
    };

    const removePayment = async (paymentId: number) => {
        await applyResult(await DeleteOrderPayment(paymentId));
    };

    /** Choosing a card puts the card fee on the total; anything else takes it back off. */
    const changeMethod = async (method: PaymentMethod) => {
        await saveOrder({ applyCcProcessingFee: method === "VisaMc" });
    };

    /** No card fee on this order, even when it is paid by card - or the fee back on. */
    const waiveFee = async (waive: boolean) => {
        await saveOrder({ waiveCcProcessingFee: waive });
    };

    // Stock moves as other orders complete, so the picker always opens on fresh counts.
    const openAddItem = () => {
        setShowAddItem(true);
        GetProducts().then((catalog) => {
            if (catalog.length) setProducts(catalog);
        });
    };

    /** The item an upcharge being edited belongs to. */
    const upchargeParent = (line: OrderLine): OrderLine =>
        order?.lines?.find((l) => l.id === line.parentLineId) ?? line;

    return {
        saveOrder,
        addLine,
        reorderLines,
        updateLine,
        changeQuantity,
        removeLine,
        addPayment,
        removePayment,
        changeMethod,
        waiveFee,
        showAddItem,
        openAddItem,
        closeAddItem: () => setShowAddItem(false),
        editingLine,
        setEditingLine,
        upchargeParent,
        servicingLine,
        setServicingLine,
        upchargingLine,
        setUpchargingLine,
        removingLine,
        setRemovingLine,
    };
};
