import type { Order } from "../Models/Order";
import type { OrderLine } from "../Models/OrderLine";
import type { OrderPayment, PaymentMethod } from "../Models/OrderPayment";
import type { SalesTermKey } from "../Models/GeneralSettings";
import { FormatCurrency } from "./Format";

/**
 * What each payment method is called on screen and on the printed sheet. The stored value stays
 * VisaMc so older orders keep reading correctly.
 */
export const PaymentMethodLabels: Record<PaymentMethod, string> = {
    Cash: "Cash",
    Check: "Check",
    VisaMc: "Credit/Debit Card",
    Financing: "Financing",
    Layaway: "Layaway",
};

/**
 * A financing payment's details as one line, e.g. "12 months no interest - Financing # 4471".
 * @param payment The payment.
 * @returns The line, or an empty string when it has no details.
 */
export const FinancingText = (payment: OrderPayment): string =>
    [
        payment.financeType?.trim(),
        payment.reference?.trim() ? `Financing # ${payment.reference.trim()}` : "",
    ]
        .filter(Boolean)
        .join(" - ");

/**
 * The financing lines printed in the sales sheet's comments, one per financing payment, e.g.
 * "Financing: 12 months no interest - Financing # 4471 - $1,250.00".
 * @param order The order.
 * @returns The lines, in the order recorded.
 */
export const FinancingComments = (order: Order): string[] =>
    (order.payments ?? [])
        .filter((p) => p.method === "Financing")
        .map(
            (p) =>
                `Financing: ${[FinancingText(p), FormatCurrency(p.amount)].filter(Boolean).join(" - ")}`
        );

/**
 * Whether a line prints on the sales sheet. Shipping rows whose option is set not to show (Take
 * With, by default) are left off - unless they carry a charge, which always prints so the
 * sheet's subtotal still adds up.
 * @param line The order line.
 * @returns True when the line belongs on the printed sheet.
 */
export const PrintsOnSalesSheet = (line: OrderLine): boolean =>
    line.lineType !== "Delivery" || line.showOnSalesSheet !== false || (line.lineTotal ?? 0) !== 0;

/**
 * Groups order lines so each delivery charge sits directly under the product it belongs to,
 * which is how the paper sheet reads.
 * @param lines The order's lines.
 * @returns Lines in print order.
 */
export const SortLinesForPrint = (lines: OrderLine[]): OrderLine[] => {
    const sorted = [...lines].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const children = new Map<number, OrderLine[]>();
    const roots: OrderLine[] = [];

    sorted.forEach((line) => {
        if (line.parentLineId) {
            const bucket = children.get(line.parentLineId) ?? [];
            bucket.push(line);
            children.set(line.parentLineId, bucket);
        } else {
            roots.push(line);
        }
    });

    // Under each item: what a bundle includes, then upcharges, then shipping and services.
    const rank = (line: OrderLine) =>
        line.lineType === "Included"
            ? 0
            : line.lineType === "Upcharge"
              ? 1
              : line.lineType === "Delivery"
                ? 2
                : 3;

    const result: OrderLine[] = [];
    roots.forEach((root) => {
        result.push(root);
        [...(children.get(root.id ?? -1) ?? [])]
            .sort((a, b) => rank(a) - rank(b))
            .forEach((child) => result.push(child));
    });

    // Any orphan whose parent was removed still has to print rather than silently vanish.
    sorted.forEach((line) => {
        if (!result.includes(line)) result.push(line);
    });

    return result;
};

/**
 * A product's warranty as the rep reads it out, e.g. "Warranty: 10 years".
 * @param product The product.
 * @returns The wording, or nothing for a product without one.
 */
export const WarrantyText = (product: {
    hasWarranty?: boolean;
    warrantyLength?: string | null;
}): string | null => {
    if (!product.hasWarranty) return null;
    const length = product.warrantyLength?.trim();
    return length ? `Warranty: ${length}` : "Manufacturer warranty";
};

/** Every statement, in signing order. */
const ALL_TERMS: SalesTermKey[] = ["customerInfo", "warranty", "dropShip", "advisory"];

/**
 * The statements an order needs initialled, worked out by the API from what is on it - a pillow
 * taken home today skips the warranty, drop ship and details steps.
 * @param order The order.
 * @returns The keys that apply, in signing order.
 */
export const RequiredTerms = (order: Order): SalesTermKey[] =>
    ALL_TERMS.filter((key) => (order.requiredTerms ?? ALL_TERMS).includes(key));

/**
 * The initials an order has against a statement.
 * @param order The order.
 * @param key The statement.
 * @returns The initials, or nothing.
 */
export const InitialsFor = (order: Order, key: SalesTermKey): string | null | undefined =>
    ({
        customerInfo: order.customerInfoInitials,
        warranty: order.warrantyInitials,
        dropShip: order.dropShipInitials,
        advisory: order.advisoryInitials,
    })[key];

/**
 * What the sales sheet prints in a statement's INITIAL box: the initials, or N/A for one the order
 * didn't need.
 * @param order The order.
 * @param key The statement.
 * @returns The text for the box.
 */
export const PrintedInitials = (order: Order, key: SalesTermKey): string =>
    InitialsFor(order, key)?.trim() || (RequiredTerms(order).includes(key) ? "" : "N/A");

/**
 * Whether the customer has initialled every statement the order needs and signed - everything
 * the sales sheet needs before checkout can complete the sale.
 * @param order The order.
 * @returns True when every acknowledgement is in.
 */
export const IsAcknowledged = (order: Order): boolean =>
    Boolean(order.customerSignature) &&
    RequiredTerms(order).every((key) => Boolean(InitialsFor(order, key)?.trim()));

/**
 * One address as printed lines, e.g. ["211 Central Drive, Unit 4", "Butler, PA 16001"].
 * @param parts The address fields.
 * @returns The non-empty lines.
 */
export const AddressLines = (parts: {
    address?: string | null;
    unit?: string | null;
    floor?: string | null;
    suite?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
}): string[] => {
    const street = [
        parts.address,
        parts.unit && `Unit ${parts.unit}`,
        parts.floor && `Floor ${parts.floor}`,
        parts.suite && `Suite ${parts.suite}`,
    ]
        .filter(Boolean)
        .join(", ");
    const town = [parts.city, [parts.state, parts.zip].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", ");
    return [street, town].filter(Boolean);
};

const PHONE_FIELDS = new Set(["billingCell", "billingAlt", "deliveryCell", "deliveryAlt"]);

const STATE_FIELDS = new Set(["billingState", "deliveryState"]);

const EMAIL_FIELDS = new Set(["billingEmail", "deliveryEmail"]);

const ZIP_FIELDS = new Set(["billingZip", "deliveryZip"]);

/**
 * Tidies one customer detail as it is saved: a ten-digit phone number becomes (724) 555-0100, a
 * state becomes upper case, an email lower case, and stray spaces go. Anything unrecognised is
 * kept as typed, so an international number or an unusual address is never mangled.
 * @param key The order field.
 * @param value What was typed.
 * @returns The tidied value.
 */
export const NormalizeCustomerField = (key: string, value: string): string => {
    const trimmed = value.replace(/\s+/g, " ").trim();
    if (PHONE_FIELDS.has(key)) {
        const digits = trimmed.replace(/\D/g, "");
        const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
        return local.length === 10
            ? `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`
            : trimmed;
    }
    if (STATE_FIELDS.has(key)) return trimmed.toUpperCase();
    if (EMAIL_FIELDS.has(key)) return trimmed.replace(/\s/g, "").toLowerCase();
    if (ZIP_FIELDS.has(key)) return trimmed.replace(/\s/g, "");
    return trimmed;
};

/**
 * Tidies every text field of a customer-details update. See NormalizeCustomerField.
 * @param changes The fields being saved.
 * @returns The same fields, tidied.
 */
export const NormalizeCustomer = (changes: Order): Order =>
    Object.fromEntries(
        Object.entries(changes).map(([key, value]) => [
            key,
            typeof value === "string" ? NormalizeCustomerField(key, value) : value,
        ])
    ) as Order;
