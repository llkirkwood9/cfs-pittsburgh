import type { Event } from "../Models/Event";
import type { OrderStatus } from "../Models/Order";
import type { OrderSummary } from "../Models/OrderSummary";
import { FormatCurrency } from "./Format";

/** Which orders the Orders screen lists: one event's, or every event's. */
export type OrderScope = { kind: "event"; eventId: number } | { kind: "all" };

/** What each order status is called on the Orders screen. */
export const OrderStatusLabels: Record<OrderStatus, string> = {
    Draft: "On the floor",
    AwaitingCheckout: "At checkout",
    Completed: "Completed",
    Voided: "Voided",
};

/** The status filters, in the order they're offered. */
export const OrderStatusFilters = [
    "All",
    "Completed",
    "AwaitingCheckout",
    "Draft",
    "Voided",
] as const;

export type OrderStatusFilter = (typeof OrderStatusFilters)[number];

/**
 * A line over the list: how many orders it holds, what they come to and what is still owed.
 * Voided orders are listed but not counted in the money.
 * @param orders The orders listed.
 * @returns The line.
 */
export const SummarizeOrders = (orders: OrderSummary[]): string => {
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
 * Narrows orders to a search on customer, rep, email, order number or phone. A phone number
 * matches on its digits alone, however it was typed or stored.
 * @param rows The orders.
 * @param term What was typed.
 * @returns The matching orders.
 */
export const FilterOrders = (rows: OrderSummary[], term: string): OrderSummary[] => {
    const text = term.trim().toLowerCase();
    if (!text) return rows;
    const digits = text.replace(/\D/g, "");
    const phoneMatch = (value?: string | null) =>
        digits.length >= 4 && (value ?? "").replace(/\D/g, "").includes(digits);
    return rows.filter(
        (o) =>
            (o.billingName ?? "").toLowerCase().includes(text) ||
            (o.cfsRepName ?? "").toLowerCase().includes(text) ||
            (o.billingEmail ?? "").toLowerCase().includes(text) ||
            String(o.orderNumber ?? "").includes(text) ||
            phoneMatch(o.billingCell) ||
            phoneMatch(o.billingAlt)
    );
};

/**
 * Which orders the screen opens on: the active event's. Between fundraisers there is no active
 * event; a manager falls back to every event, while everyone else has nothing current to show -
 * all-events history is for managers up.
 * @param active The active event, if any.
 * @param isManager Whether the user is a manager or above.
 * @returns The scope, or null for nothing to show.
 */
export const StartingOrderScope = (active: Event | null, isManager: boolean): OrderScope | null =>
    active?.id ? { kind: "event", eventId: active.id } : isManager ? { kind: "all" } : null;

/**
 * Whether the list offers Void for an order: one still on the floor or at checkout. (The server
 * also lets a manager void a completed sale; the list leaves that to Reopen.)
 * @param order The order.
 * @returns True when Void is offered.
 */
export const CanVoidFromList = (order: OrderSummary): boolean =>
    order.status === "Draft" || order.status === "AwaitingCheckout";

/**
 * Whether the list offers Reopen for an order: one at checkout, completed or voided.
 * @param order The order.
 * @returns True when Reopen is offered.
 */
export const CanReopenFromList = (order: OrderSummary): boolean =>
    order.status === "Completed" ||
    order.status === "AwaitingCheckout" ||
    order.status === "Voided";

const forWhom = (o: OrderSummary) => (o.billingName ? ` for ${o.billingName}` : "");

/**
 * What voiding an order from the list asks first.
 * @param o The order.
 * @returns The message.
 */
export const VoidOrderMessage = (o: OrderSummary): string =>
    `Void order #${o.orderNumber}${forWhom(o)}? It ${
        o.status === "Draft" ? "comes off the sales floor" : "leaves the checkout queue"
    } and stays on file for the audit trail. It can be reopened later.`;

/**
 * What deleting an order for good asks first.
 * @param o The order.
 * @returns The message.
 */
export const DeleteOrderMessage = (o: OrderSummary): string =>
    `Permanently delete order #${o.orderNumber}${forWhom(o)}, with its items and payments? It comes off every total and its sales sheet is gone. Stock that went home is not put back - reopen or void the sale first if it should be. This cannot be undone.`;
