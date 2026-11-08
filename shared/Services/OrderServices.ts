import { client } from "@host";
import { CheckoutQueueChanged } from "../Lib/CheckoutWaiting";
import { CallApi } from "./CallApi";
import type { Order, OrderStatus } from "../Models/Order";
import type { OrderLine } from "../Models/OrderLine";
import type { OrderPayment } from "../Models/OrderPayment";
import type { OrderSummary } from "../Models/OrderSummary";

//*************************************//
//*********** POST METHODS ************//
//*************************************//

/**
 * Opens a new draft order against an event.
 * @param eventId The event to write the order against.
 * @param draftLabel An optional label the rep uses to tell drafts apart.
 * @returns The created order, or null on failure.
 */
export const AddOrder = async (eventId: number, draftLabel?: string): Promise<Order | null> => {
    return CallApi(async () => {
        const response = await client.api.post<Order>("/api/Order/order", {
            eventId,
            draftLabel,
        });
        return response.data;
    }, null);
};

/**
 * Adds a line to an order. Pass deliveryOptionId alongside a product to attach its
 * delivery charge in the same call.
 * @param orderId The order id.
 * @param line The line to add.
 * @returns The recalculated order, or null on failure.
 */
export const AddOrderLine = async (orderId: number, line: OrderLine): Promise<Order | null> => {
    return CallApi(async () => {
        const response = await client.api.post<Order>(`/api/Order/order/${orderId}/line`, line);
        return response.data;
    }, null);
};

/**
 * Adds a payment row to an order.
 * @param orderId The order id.
 * @param payment The payment to record.
 * @returns The recalculated order, or null on failure.
 */
export const AddOrderPayment = async (
    orderId: number,
    payment: OrderPayment
): Promise<Order | null> => {
    return CallApi(async () => {
        const response = await client.api.post<Order>(
            `/api/Order/order/${orderId}/payment`,
            payment
        );
        return response.data;
    }, null);
};

/**
 * Hands a draft to the checkout table.
 * @param orderId The order id.
 * @returns The submitted order, or null on failure.
 */
export const SubmitOrder = async (orderId: number): Promise<Order | null> => {
    return CallApi(async () => {
        const response = await client.api.post<Order>(`/api/Order/order/${orderId}/submit`);
        CheckoutQueueChanged();
        return response.data;
    }, null);
};

/**
 * Closes an order at the checkout table.
 * @param orderId The order id.
 * @returns The completed order, or null on failure.
 */
export const CompleteOrder = async (orderId: number): Promise<Order | null> => {
    return CallApi(async () => {
        const response = await client.api.post<Order>(`/api/Order/order/${orderId}/complete`);
        CheckoutQueueChanged();
        return response.data;
    }, null);
};

/**
 * Sends an order back to the sales floor or the checkout table. Reopening a completed sale is
 * admin only.
 * @param orderId The order id.
 * @param to Where the order goes; defaults to the sales floor.
 * @returns The reopened order, or null on failure.
 */
export const ReopenOrder = async (
    orderId: number,
    to: "floor" | "checkout" = "floor"
): Promise<Order | null> => {
    return CallApi(async () => {
        const response = await client.api.post<Order>(`/api/Order/order/${orderId}/reopen`, null, {
            params: { to },
        });
        CheckoutQueueChanged();
        return response.data;
    }, null);
};

/**
 * Voids an order, keeping it for the audit trail but dropping it from every total.
 * @param orderId The order id.
 * @returns The voided order, or null on failure.
 */
export const VoidOrder = async (orderId: number): Promise<Order | null> => {
    return CallApi(async () => {
        const response = await client.api.post<Order>(`/api/Order/order/${orderId}/void`);
        CheckoutQueueChanged();
        return response.data;
    }, null);
};

/**
 * Clears an open order at close-out. The server voids one that reached checkout or has a payment,
 * and deletes a draft with nothing paid.
 * @param orderId The order id.
 * @returns Whether it was voided (true) or deleted (false), or null on failure.
 */
export const ClearOrder = async (orderId: number): Promise<boolean | null> => {
    return CallApi(async () => {
        const response = await client.api.post<{ voided: boolean }>(
            `/api/Order/order/${orderId}/clear`
        );
        CheckoutQueueChanged();
        return response.data.voided;
    }, null);
};

//************************************//
//*********** GET METHODS ************//
//************************************//

/**
 * Lists orders for an event, optionally filtered by status.
 * @param eventId The event id.
 * @param status An optional status filter.
 * @returns Order summaries, or null on failure.
 */
export const GetOrdersForEvent = async (
    eventId: number,
    status?: OrderStatus
): Promise<OrderSummary[] | null> => {
    return CallApi(async () => {
        const response = await client.api.get<OrderSummary[]>(
            `/api/Order/orders/event/${eventId}`,
            {
                params: status ? { status } : undefined,
            }
        );
        return response.data;
    }, null);
};

/**
 * Lists the drafts currently open, so a rep can juggle several customers at once.
 * @param eventId The event id.
 * @param all Pass true to see every rep's drafts rather than just your own.
 * @returns Draft summaries, or null on failure.
 */
export const GetDrafts = async (eventId: number, all = false): Promise<OrderSummary[] | null> => {
    return CallApi(async () => {
        const response = await client.api.get<OrderSummary[]>(
            `/api/Order/orders/drafts/event/${eventId}`,
            {
                params: { all },
            }
        );
        return response.data;
    }, null);
};

/**
 * The checkout queue for an event, oldest first.
 * @param eventId The event id.
 * @returns Order summaries awaiting checkout, or null on failure.
 */
export const GetCheckoutQueue = async (eventId: number): Promise<OrderSummary[] | null> => {
    return CallApi(async () => {
        const response = await client.api.get<OrderSummary[]>(
            `/api/Order/orders/checkout/event/${eventId}`
        );
        return response.data;
    }, null);
};

/**
 * Every order across every event, newest first. Admin only.
 * @param options Optional status filter, search term and row cap.
 * @returns Order summaries, or null on failure.
 */
export const GetAllOrders = async (options?: {
    status?: OrderStatus;
    search?: string;
    take?: number;
}): Promise<OrderSummary[] | null> => {
    return CallApi(async () => {
        const response = await client.api.get<OrderSummary[]>("/api/Order/orders", {
            params: {
                status: options?.status,
                search: options?.search || undefined,
                take: options?.take ?? 200,
            },
        });
        return response.data;
    }, null);
};

/**
 * Full orders for an event, for printing every sales sheet at once or exporting. Admin only.
 * @param eventId The event id.
 * @param status Which orders to include; the API defaults to completed sales.
 * @returns Full orders in order-number order, or null on failure.
 */
export const GetSalesSheetsForEvent = async (
    eventId: number,
    status?: OrderStatus
): Promise<Order[] | null> => {
    return CallApi(async () => {
        const response = await client.api.get<Order[]>(
            `/api/Order/orders/event/${eventId}/sheets`,
            {
                params: status ? { status } : undefined,
            }
        );
        return response.data;
    }, null);
};

/**
 * Gets a full order including lines and payments.
 * @param id The order id.
 * @returns The order, or null on failure.
 */
export const GetOrder = async (id: number): Promise<Order | null> => {
    return CallApi(async () => {
        const response = await client.api.get<Order>(`/api/Order/order/${id}`);
        return response.data;
    }, null);
};

//**************************************//
//*********** PATCH METHODS ************//
//**************************************//

/**
 * Updates the header, customer, delivery and acknowledgement fields of an order.
 * @param orderData The fields to change, including the id.
 * @returns The recalculated order, or null on failure.
 */
export const UpdateOrder = async (orderData: Order): Promise<Order | null> => {
    return CallApi(async () => {
        const response = await client.api.patch<Order>("/api/Order/order", orderData);
        return response.data;
    }, null);
};

/**
 * Puts an order's items in a new order; each item's own rows move with it.
 * @param orderId The order id.
 * @param itemIds Every item line's id, in the new order.
 * @returns The order with its lines in the new order, or null on failure.
 */
export const ReorderOrderLines = async (
    orderId: number,
    itemIds: number[]
): Promise<Order | null> => {
    return CallApi(async () => {
        const response = await client.api.put<Order>(
            `/api/Order/order/${orderId}/lines/order`,
            itemIds
        );
        return response.data;
    }, null);
};

/**
 * Updates one line of an order.
 * @param line The fields to change, including the line id.
 * @returns The recalculated order, or null on failure.
 */
export const UpdateOrderLine = async (line: OrderLine): Promise<Order | null> => {
    return CallApi(async () => {
        const response = await client.api.patch<Order>("/api/Order/line", line);
        return response.data;
    }, null);
};

//***************************************//
//*********** DELETE METHODS ************//
//***************************************//

/**
 * Deletes a draft order outright.
 * @param id The order id.
 * @param permanent System admin only: delete for good.
 * @returns True if the operation was successful, false otherwise.
 */
export const DeleteOrder = async (id: number, permanent = false): Promise<boolean> => {
    return CallApi(async () => {
        // permanent is system-admin-only: it deletes for good instead of archiving or refusing.
        const response = await client.api.delete(`/api/Order/order/${id}`, {
            params: permanent ? { permanent: true } : undefined,
        });
        CheckoutQueueChanged();
        return response.status === 200;
    }, false);
};

/**
 * Removes a line and any delivery charge attached to it.
 * @param id The line id.
 * @returns The recalculated order, or null on failure.
 */
export const DeleteOrderLine = async (id: number): Promise<Order | null> => {
    return CallApi(async () => {
        const response = await client.api.delete<Order>(`/api/Order/line/${id}`);
        return response.data;
    }, null);
};

/**
 * Removes a payment row.
 * @param id The payment id.
 * @returns The recalculated order, or null on failure.
 */
export const DeleteOrderPayment = async (id: number): Promise<Order | null> => {
    return CallApi(async () => {
        const response = await client.api.delete<Order>(`/api/Order/payment/${id}`);
        return response.data;
    }, null);
};
