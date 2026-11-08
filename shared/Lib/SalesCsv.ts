import type { Event } from "../Models/Event";
import type { Order } from "../Models/Order";
import type { PaymentMethod } from "../Models/OrderPayment";
import {
    FinancingComments,
    PaidBy,
    PaymentMethodLabels,
    PrintsOnSalesSheet,
    SortLinesForPrint,
} from "./Orders";

/**
 * Quotes one CSV field. Everything is quoted so commas in an address or a comment never shift a
 * column, and a leading = + - @ is neutralised so a spreadsheet will not run it as a formula.
 * @param value The raw value.
 * @returns The quoted field.
 */
const field = (value: string | number | null | undefined): string => {
    let text = value === null || value === undefined ? "" : String(value);
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
};

/**
 * One row per sale with the figures the event's paperwork needs. Items are flattened into a
 * single readable cell rather than one row per line, so the file opens straight into a usable
 * spreadsheet.
 * @param orders Full orders, lines and payments included.
 * @returns The CSV text.
 */
export const BuildSalesCsv = (orders: Order[]): string => {
    const methods = Object.keys(PaymentMethodLabels) as PaymentMethod[];

    const header = [
        "Order #",
        "Sale Date",
        "Customer",
        "Address",
        "Unit",
        "City",
        "State",
        "Zip",
        "Cell",
        "Email",
        "Referral Name",
        "CFS Rep",
        "Items",
        "Comments",
        "Subtotal",
        "Sales Tax",
        "CC Processing Fee",
        "Total",
        ...methods.map((m) => PaymentMethodLabels[m]),
        "Check #",
        "Balance Due",
        "Completed At",
    ];

    const rows = orders.map((order) => {
        const items = SortLinesForPrint(order.lines ?? [])
            .filter(PrintsOnSalesSheet)
            .map((line) => {
                const prefix =
                    line.lineType === "Delivery"
                        ? "  Ship: "
                        : line.lineType === "Included"
                          ? "  Incl: "
                          : line.lineType === "Upcharge"
                            ? "  Upcharge: "
                            : "";
                const size = line.size ? `${line.size} ` : "";
                const qty =
                    line.lineType === "Delivery" || line.lineType === "Upcharge"
                        ? ""
                        : `${line.quantity} x `;
                const note = line.notes ? ` (Note: ${line.notes.replace(/\s+/g, " ")})` : "";
                return `${prefix}${qty}${size}${line.description}${note}`;
            })
            .join("\n");

        const checkNumbers = (order.payments ?? [])
            .filter((p) => p.method === "Check" && p.checkNumber)
            .map((p) => p.checkNumber)
            .join(", ");

        return [
            order.orderNumber,
            order.saleDate?.slice(0, 10),
            order.billingName,
            order.billingAddress,
            order.billingUnit,
            order.billingCity,
            order.billingState,
            order.billingZip,
            order.billingCell,
            order.billingEmail,
            order.referralName,
            order.cfsRepName,
            items,
            // The comments as printed on the sales sheet, financing details included.
            [order.comments, ...FinancingComments(order)].filter(Boolean).join(" | "),
            (order.subtotal ?? 0).toFixed(2),
            (order.taxAmount ?? 0).toFixed(2),
            (order.ccProcessingFee ?? 0).toFixed(2),
            (order.total ?? 0).toFixed(2),
            ...methods.map((m) => (PaidBy(order, m) ?? 0).toFixed(2)),
            checkNumbers,
            (order.balanceDue ?? 0).toFixed(2),
            order.completedAt ? new Date(order.completedAt).toLocaleString("en-US") : "",
        ];
    });

    return [header, ...rows].map((row) => row.map(field).join(",")).join("\r\n");
};

/**
 * The start of an event's export file names, e.g. "school-band-2026-09-21", followed by
 * "-sales.csv" or "-sales-sheets".
 * @param event The event.
 * @returns The name, lower case with dashes.
 */
export const EventFileBase = (event: Event | null): string => {
    const slug = `${event?.organization || "event"}`
        .trim()
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase();
    return `${slug}-${(event?.eventDate ?? "").slice(0, 10)}`;
};
