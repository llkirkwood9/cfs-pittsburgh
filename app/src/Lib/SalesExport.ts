import { ShareTextFile } from "./Files";
import {
    FinancingComments,
    PaymentMethodLabels,
    PrintsOnSalesSheet,
    SortLinesForPrint,
} from "./ModelHelpers";
import type { Order } from "../Models/Order";
import type { PaymentMethod } from "../Models/OrderPayment";

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
 * Totals the payments on an order for one method.
 * @param order The order.
 * @param method The payment method.
 * @returns The amount, to two decimal places.
 */
const paid = (order: Order, method: PaymentMethod): string =>
    (order.payments ?? [])
        .filter((p) => p.method === method)
        .reduce((sum, p) => sum + (p.amount ?? 0), 0)
        .toFixed(2);

/**
 * One row per sale with the figures the event's paperwork needs. Items are flattened into a
 * single readable cell rather than one row per line, so the file opens straight into a usable
 * spreadsheet.
 * @param orders Full orders, lines and payments included.
 * @returns The CSV text.
 */
export const BuildSalesCsv = (orders: Order[]): string => {
    const methods: PaymentMethod[] = ["Cash", "Check", "VisaMc", "Financing", "Layaway"];

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
            ...methods.map((m) => paid(order, m)),
            checkNumbers,
            (order.balanceDue ?? 0).toFixed(2),
            order.completedAt ? new Date(order.completedAt).toLocaleString("en-US") : "",
        ];
    });

    return [header, ...rows].map((row) => row.map(field).join(",")).join("\r\n");
};

/**
 * Hands the CSV to the device's share sheet - Files, Mail, Numbers, Excel, AirDrop.
 * @param filename Name the file is saved as.
 * @param text File contents.
 */
export const DownloadCsv = async (filename: string, text: string): Promise<void> => {
    // The byte-order mark makes Excel read the file as UTF-8 rather than mangling accents.
    const bom = String.fromCharCode(0xfeff);
    await ShareTextFile(filename, bom + text, "text/csv", "public.comma-separated-values-text");
};
