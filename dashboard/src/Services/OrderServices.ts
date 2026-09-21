import api from "../Lib/api";
import { HandleAxiosError } from "../Lib/ErrorHandler";
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
    try {
        const response = await api.post<Order>("/api/Order/order", { eventId, draftLabel });
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};

/**
 * Adds a line to an order. Pass deliveryOptionId alongside a product to attach its
 * delivery charge in the same call.
 * @param orderId The order id.
 * @param line The line to add.
 * @returns The recalculated order, or null on failure.
 */
export const AddOrderLine = async (orderId: number, line: OrderLine): Promise<Order | null> => {
    try {
        const response = await api.post<Order>(`/api/Order/order/${orderId}/line`, line);
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
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
    try {
        const response = await api.post<Order>(`/api/Order/order/${orderId}/payment`, payment);
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};

/**
 * Hands a draft to the checkout table.
 * @param orderId The order id.
 * @returns The submitted order, or null on failure.
 */
export const SubmitOrder = async (orderId: number): Promise<Order | null> => {
    try {
        const response = await api.post<Order>(`/api/Order/order/${orderId}/submit`);
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};

/**
 * Closes an order at the checkout table.
 * @param orderId The order id.
 * @returns The completed order, or null on failure.
 */
export const CompleteOrder = async (orderId: number): Promise<Order | null> => {
    try {
        const response = await api.post<Order>(`/api/Order/order/${orderId}/complete`);
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};

/**
 * Sends an order back to the sales floor.
 * @param orderId The order id.
 * @returns The reopened order, or null on failure.
 */
export const ReopenOrder = async (orderId: number): Promise<Order | null> => {
    try {
        const response = await api.post<Order>(`/api/Order/order/${orderId}/reopen`);
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};

/**
 * Voids an order, keeping it for the audit trail but dropping it from every total.
 * @param orderId The order id.
 * @returns The voided order, or null on failure.
 */
export const VoidOrder = async (orderId: number): Promise<Order | null> => {
    try {
        const response = await api.post<Order>(`/api/Order/order/${orderId}/void`);
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};

//************************************//
//*********** GET METHODS ************//
//************************************//

/**
 * Lists orders for an event, optionally filtered by status.
 * @param eventId The event id.
 * @param status An optional status filter.
 * @returns Order summaries, or an empty list on failure.
 */
export const GetOrdersForEvent = async (
    eventId: number,
    status?: OrderStatus
): Promise<OrderSummary[]> => {
    try {
        const response = await api.get<OrderSummary[]>(`/api/Order/orders/event/${eventId}`, {
            params: status ? { status } : undefined,
        });
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return [];
    }
};

/**
 * Lists the drafts currently open, so a rep can juggle several customers at once.
 * @param eventId The event id.
 * @param all Pass true to see every rep's drafts rather than just your own.
 * @returns Draft summaries, or an empty list on failure.
 */
export const GetDrafts = async (eventId: number, all = false): Promise<OrderSummary[]> => {
    try {
        const response = await api.get<OrderSummary[]>(`/api/Order/orders/drafts/event/${eventId}`, {
            params: { all },
        });
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return [];
    }
};

/**
 * The checkout queue for an event, oldest first.
 * @param eventId The event id.
 * @returns Order summaries awaiting checkout, or an empty list on failure.
 */
export const GetCheckoutQueue = async (eventId: number): Promise<OrderSummary[]> => {
    try {
        const response = await api.get<OrderSummary[]>(`/api/Order/orders/checkout/event/${eventId}`);
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return [];
    }
};

/**
 * Every order across every event, newest first. Admin only.
 * @param options Optional status filter, search term and row cap.
 * @returns Order summaries, or an empty list on failure.
 */
export const GetAllOrders = async (options?: {
    status?: OrderStatus;
    search?: string;
    take?: number;
}): Promise<OrderSummary[]> => {
    try {
        const response = await api.get<OrderSummary[]>("/api/Order/orders", {
            params: {
                status: options?.status,
                search: options?.search || undefined,
                take: options?.take ?? 200,
            },
        });
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return [];
    }
};

/**
 * Gets a full order including lines and payments.
 * @param id The order id.
 * @returns The order, or null on failure.
 */
export const GetOrder = async (id: number): Promise<Order | null> => {
    try {
        const response = await api.get<Order>(`/api/Order/order/${id}`);
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
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
    try {
        const response = await api.patch<Order>("/api/Order/order", orderData);
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};

/**
 * Updates one line of an order.
 * @param line The fields to change, including the line id.
 * @returns The recalculated order, or null on failure.
 */
export const UpdateOrderLine = async (line: OrderLine): Promise<Order | null> => {
    try {
        const response = await api.patch<Order>("/api/Order/line", line);
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};

/**
 * Updates one payment row of an order.
 * @param payment The fields to change, including the payment id.
 * @returns The recalculated order, or null on failure.
 */
export const UpdateOrderPayment = async (payment: OrderPayment): Promise<Order | null> => {
    try {
        const response = await api.patch<Order>("/api/Order/payment", payment);
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};

//***************************************//
//*********** DELETE METHODS ************//
//***************************************//

/**
 * Deletes a draft order outright.
 * @param id The order id.
 * @returns True if the operation was successful, false otherwise.
 */
export const DeleteOrder = async (id: number): Promise<boolean> => {
    try {
        const response = await api.delete(`/api/Order/order/${id}`);
        return response.status === 200;
    } catch (error) {
        HandleAxiosError(error);
        return false;
    }
};

/**
 * Removes a line and any delivery charge attached to it.
 * @param id The line id.
 * @returns The recalculated order, or null on failure.
 */
export const DeleteOrderLine = async (id: number): Promise<Order | null> => {
    try {
        const response = await api.delete<Order>(`/api/Order/line/${id}`);
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};

/**
 * Removes a payment row.
 * @param id The payment id.
 * @returns The recalculated order, or null on failure.
 */
export const DeleteOrderPayment = async (id: number): Promise<Order | null> => {
    try {
        const response = await api.delete<Order>(`/api/Order/payment/${id}`);
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};
