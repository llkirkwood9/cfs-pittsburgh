import type { DashboardStats } from "../Models/DashboardStats";
import type { Order } from "../Models/Order";
import type { PaymentMethod } from "../Models/OrderPayment";

/** One itemised line on the stat sheet, e.g. "#1042 ck 381  $250.00". */
export type StatSheetEntry = { key: string; label: string; amount: number };

/** Minimum ruled lines per itemised column, so a quiet event still looks like the paper form. */
export const MIN_LIST_ROWS = 14;

/**
 * The stat sheet's itemised lines for one way of paying: one per payment, labelled with the
 * order number (and the check number, for a check).
 * @param orders The event's completed orders.
 * @param method The way of paying.
 * @returns The lines, in order.
 */
export const StatSheetEntries = (orders: Order[], method: PaymentMethod): StatSheetEntry[] =>
    orders.flatMap((order) =>
        (order.payments ?? [])
            .filter((p) => p.method === method)
            .map((p, index) => ({
                key: `${order.id}-${p.id ?? index}`,
                label:
                    method === "Check" && p.checkNumber
                        ? `#${order.orderNumber} ck ${p.checkNumber}`
                        : `#${order.orderNumber}`,
                amount: p.amount ?? 0,
            }))
    );

/**
 * The stat sheet's average sale - as on the paper sheet, total sales divided by the number of
 * mattresses and bases, not by the number of orders.
 * @param stats The event's figures.
 * @returns The average, or 0 with none sold.
 */
export const StatSheetAverageSale = (stats: DashboardStats | null): number => {
    const units = stats?.mattressAndBaseCount ?? 0;
    return units > 0 ? (stats?.totalSales ?? 0) / units : 0;
};
