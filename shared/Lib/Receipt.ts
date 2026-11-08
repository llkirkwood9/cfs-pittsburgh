import { FormatCurrency } from "./Format";
import {
    CardFeeWaived,
    FinancingComments,
    PaidBy,
    PaymentMethodLabels,
    PrintsOnSalesSheet,
    SortLinesForPrint,
} from "./Orders";
import { TermFor } from "../Models/GeneralSettings";
import type { SalesTerm, SalesTermKey } from "../Models/GeneralSettings";
import type { Order, OrderStatus } from "../Models/Order";
import type { OrderLine } from "../Models/OrderLine";
import type { PaymentMethod } from "../Models/OrderPayment";

/** Blank rows are padded out to this many so the printed grid matches the paper form. */
export const MIN_ITEM_ROWS = 14;

/** Height of one item row on the paper form. The grid never grows taller than 14 of these. */
export const ROW_PX = 20;

/** The shortest a row can get and still be readable. */
const MIN_ROW_PX = 12;

/** What a sheet for an unfinished order is stamped with, on screen and on paper. */
const UNFINISHED: Partial<Record<OrderStatus, { stamp: string; detail: string }>> = {
    Draft: {
        stamp: "NOT COMPLETED",
        detail: "This order is still being written up on the sales floor.",
    },
    AwaitingCheckout: {
        stamp: "NOT COMPLETED",
        detail: "This order is waiting at the checkout table and has not been paid.",
    },
    Voided: {
        stamp: "VOIDED",
        detail: "This order was voided and is not a valid sale.",
    },
};

/** One row of the payment options and totals block: method, amount, total label, total. */
export type ReceiptPaymentRow = {
    method: string;
    amount: string;
    /** "" on the Layaway row, which has no total beside it. */
    totalLabel: string;
    total: string;
    /** The total is a sum, printed bold. */
    bold?: boolean;
};

/**
 * Everything the printed sales sheet works out from an order, for both front ends to lay out.
 * A sheet always fits one page: with more lines than the paper grid holds, the rows get shorter.
 * @param order The order.
 * @param settingsTerms Today's wording for the statements, from the territory's settings.
 * @returns The sheet's figures and text.
 */
export const ReceiptModel = (order: Order, settingsTerms: SalesTerm[]) => {
    // A completed sale shows the wording the customer initialled; anything else, today's.
    const terms: SalesTerm[] = order.terms?.length ? order.terms : settingsTerms;
    const lines: OrderLine[] = SortLinesForPrint(order.lines ?? []).filter(PrintsOnSalesSheet);
    const noteRows = lines.filter((l) => l.notes).length;
    const blanks = Math.max(0, MIN_ITEM_ROWS - lines.length - noteRows);

    const rows = Math.max(lines.length + noteRows, MIN_ITEM_ROWS);
    const rowPx = Math.max(
        MIN_ROW_PX,
        Math.min(ROW_PX, Math.floor((MIN_ITEM_ROWS * ROW_PX) / rows))
    );
    const rowFont = rowPx >= ROW_PX ? 11 : rowPx >= 15 ? 10 : 9;

    const paidBy = (method: PaymentMethod): string => {
        const paid = PaidBy(order, method);
        return paid === null ? "" : FormatCurrency(paid);
    };

    // The rep who wrote the sale and whoever checked the customer out. One name when they are
    // the same person, or before checkout has happened.
    const salesName = order.cfsRepName?.trim() ?? "";
    const checkoutName = order.completedByName?.trim() ?? "";
    const showCheckout =
        checkoutName !== "" && checkoutName.toLowerCase() !== salesName.toLowerCase();

    const hasLayaway = (order.payments ?? []).some((p) => p.method === "Layaway");

    const checkNumbers = (order.payments ?? [])
        .filter((p) => p.method === "Check" && p.checkNumber)
        .map((p) => p.checkNumber)
        .join(", ");

    const cardFee =
        (order.ccProcessingFee ?? 0) > 0
            ? FormatCurrency(order.ccProcessingFee)
            : CardFeeWaived(order)
              ? "Waived"
              : "—";

    // Payment options beside the totals, each row lining up with the headings above it as on
    // the paper form.
    const paymentRows: ReceiptPaymentRow[] = [
        {
            method: PaymentMethodLabels.VisaMc,
            amount: paidBy("VisaMc"),
            totalLabel: "Sales Tax",
            total: FormatCurrency(order.taxAmount),
        },
        {
            method: "Cash",
            amount: paidBy("Cash"),
            totalLabel: "Total",
            total: FormatCurrency((order.subtotal ?? 0) + (order.taxAmount ?? 0)),
            bold: true,
        },
        {
            method: `Check #${checkNumbers ? ` ${checkNumbers}` : ""}`,
            amount: paidBy("Check"),
            totalLabel: "CC Processing Fee",
            total: cardFee,
        },
        {
            method: "Financing",
            amount: paidBy("Financing"),
            totalLabel: "Balance Due",
            total: FormatCurrency(order.total),
            bold: true,
        },
    ];
    if (hasLayaway)
        paymentRows.push({
            method: "Layaway",
            amount: paidBy("Layaway"),
            totalLabel: "",
            total: "",
        });

    return {
        terms,
        /** A statement's wording. */
        term: (key: SalesTermKey) => TermFor(terms, key),
        lines,
        /** The stamp for an unfinished order, or nothing for a completed one. */
        notice: UNFINISHED[order.status ?? "Draft"],
        blanks,
        /** Item and note rows, at least the paper form's 14. */
        rows,
        rowPx,
        /** Rows are shorter than the paper form's. */
        compact: rowPx < ROW_PX,
        rowFont,
        salesName,
        checkoutName,
        showCheckout,
        /** Each financing payment's type, number and amount, printed under the comments. */
        financing: FinancingComments(order),
        paymentRows,
    };
};
