import { FormatCurrency, FormatRate } from "./Format";
import { CardFeeWaived, NormalizeCustomer, SortLinesForPrint } from "./Orders";
import {
    PreviewPrice,
    CleanDiscount,
    DeliverySaleFor,
    DiscountText,
    type Discount,
} from "./Pricing";
import type { DeliveryOption } from "../Models/DeliveryOption";
import type { Order } from "../Models/Order";
import type { OrderLine } from "../Models/OrderLine";
import type { OrderSummary } from "../Models/OrderSummary";
import type { Product } from "../Models/Product";

/** One row of an order's totals box. */
export type TotalRow = {
    label: string;
    value: string;
    /** A total rather than a part of one. */
    strong?: boolean;
    /** Shown on a phone's compact totals as well. */
    phone?: boolean;
};

/**
 * The totals box from the bottom right of the sales sheet. Every figure is the API's, so the
 * screen and the printed receipt can never disagree.
 * @param order The order.
 * @returns The rows, top to bottom.
 */
export const OrderTotalRows = (order: Order): TotalRow[] => {
    const rows: TotalRow[] = [
        { label: "Subtotal", value: FormatCurrency(order.subtotal) },
        {
            label: `Sales tax (${FormatRate(order.salesTaxRate)})`,
            value: FormatCurrency(order.taxAmount),
        },
    ];

    if ((order.ccProcessingFee ?? 0) > 0)
        rows.push({ label: "CC processing fee", value: FormatCurrency(order.ccProcessingFee) });
    else if (CardFeeWaived(order)) rows.push({ label: "CC processing fee", value: "Waived" });

    const paid = (order.amountPaid ?? 0) > 0;

    rows.push({ label: "Total", value: FormatCurrency(order.total), strong: true, phone: true });

    if (paid) rows.push({ label: "Paid", value: FormatCurrency(order.amountPaid) });

    // Until something is paid the balance is just the total again, so a phone skips it.
    rows.push({
        label: "Balance due",
        value: FormatCurrency(order.balanceDue),
        strong: true,
        phone: paid,
    });

    return rows;
};

/**
 * A draft's tab: its number once it has one (a draft gets it with its first item), and its name.
 * @param draft The draft.
 * @returns The number prefix, such as "#1042 · ", and the label.
 */
export const DraftTabText = (draft: OrderSummary): { number: string; label: string } => ({
    number: draft.orderNumber ? `#${draft.orderNumber} · ` : "",
    label:
        draft.draftLabel ||
        draft.billingName ||
        (draft.orderNumber ? `#${draft.orderNumber}` : "New order"),
});

/**
 * Why a draft can't go to checkout yet - the API rejects an empty or unnamed order anyway, and
 * greying the button out saves the rep a round trip to find out.
 * @param order The draft.
 * @returns The reason, or undefined when it is ready.
 */
export const SendToCheckoutBlock = (order: Order): string | undefined =>
    (order.lines?.length ?? 0) === 0
        ? "Add at least one item first"
        : !order.billingFirstName?.trim() || !order.billingLastName?.trim()
          ? "Enter the customer's first and last name first"
          : undefined;

/**
 * An order's lines in sales sheet order, one group per item, each followed by its own rows
 * (shipping, upcharges, what a set includes), which move with it.
 * @param lines The order's lines.
 * @returns The groups; each group's first line is the item.
 */
export const GroupLines = (lines: OrderLine[]): OrderLine[][] => {
    const isItem = (l: OrderLine) => !l.parentLineId || !lines.some((p) => p.id === l.parentLineId);
    const groups: OrderLine[][] = [];
    for (const line of SortLinesForPrint(lines)) {
        if (isItem(line) || groups.length === 0) groups.push([line]);
        else groups[groups.length - 1].push(line);
    }
    return groups;
};

/**
 * Moves one item up or down the list.
 * @param itemIds Every item's id, in order.
 * @param index Where the item is now.
 * @param by How far to move it: -1 up, 1 down.
 * @returns The ids in their new order.
 */
export const MoveItem = (itemIds: number[], index: number, by: number): number[] => {
    const ids = [...itemIds];
    const [id] = ids.splice(index, 1);
    ids.splice(index + by, 0, id);
    return ids;
};

/**
 * The items whose adjustable base has its own row. Sets sold since the base got its own row do
 * not need the "Incl. base" badge as well; older orders still do.
 * @param lines The order's lines.
 * @returns The ids of the items with a base row.
 */
export const BaseRowParents = (lines: OrderLine[]): Set<number | null | undefined> =>
    new Set(lines.filter((l) => l.lineType === "Included").map((l) => l.parentLineId));

/**
 * The rep's own discount on a line as a badge, e.g. "-10%" or "-$50 ea".
 * @param line The line.
 * @returns The text.
 */
export const RepDiscountText = (line: OrderLine): string =>
    `-${DiscountText(CleanDiscount(line.discountPercent, line.discountAmount))}${
        (line.discountAmount ?? 0) > 0 && !(line.discountPercent ?? 0) ? " ea" : ""
    }`;

/**
 * What a shipping or service option costs on a line: the price and sale its product sets for it,
 * or the option's own.
 * @param option The option.
 * @param parentLine The item it goes on.
 * @param products The catalog.
 * @returns The list price, the sale and the price after it.
 */
export const ServicePricing = (
    option: DeliveryOption,
    parentLine: OrderLine,
    products: Product[]
): { price: number; sale: Discount; salePrice: number } => {
    const parentProduct = products.find((p) =>
        (p.variants ?? []).some((v) => v.id === parentLine.productVariantId)
    );
    const forProduct = parentProduct?.deliveryOptions?.find(
        (d) => d.deliveryOptionId === option.id
    );
    const price = forProduct?.price ?? option.price ?? 0;
    const sale = DeliverySaleFor(forProduct, option);
    return { price, sale, salePrice: PreviewPrice(price, sale) };
};

/** One field of the customer details sheet. */
export type CustomerSheetField = {
    key: keyof Order;
    label: string;
    hint?: string;
    /** Columns out of 2 on a phone and 6 from a small tablet up. */
    span: { base: 1 | 2; sm: 1 | 2 | 3 | 6 };
    /** What the field holds, for the input's type. */
    type?: "tel" | "email";
    /** The keyboard to show. */
    keyboard?: "tel" | "email";
    autoCapitalize?: "words" | "characters" | "none";
};

/** The customer's own name, address and how to reach them. */
export const CustomerBillingFields: CustomerSheetField[] = [
    {
        key: "billingFirstName",
        label: "First name",
        span: { base: 1, sm: 3 },
        autoCapitalize: "words",
    },
    {
        key: "billingLastName",
        label: "Last name",
        span: { base: 1, sm: 3 },
        autoCapitalize: "words",
    },
    {
        key: "billingAddress",
        label: "Street address",
        span: { base: 2, sm: 6 },
        autoCapitalize: "words",
    },
    { key: "billingUnit", label: "Unit #", hint: "Optional", span: { base: 1, sm: 2 } },
    { key: "billingFloor", label: "Floor", hint: "Optional", span: { base: 1, sm: 2 } },
    { key: "billingSuite", label: "Suite #", hint: "Optional", span: { base: 2, sm: 2 } },
    { key: "billingCity", label: "City", span: { base: 2, sm: 3 }, autoCapitalize: "words" },
    { key: "billingState", label: "State", span: { base: 1, sm: 1 }, autoCapitalize: "characters" },
    { key: "billingZip", label: "ZIP code", span: { base: 1, sm: 2 }, keyboard: "tel" },
    {
        key: "billingCell",
        label: "Cell phone",
        span: { base: 2, sm: 3 },
        type: "tel",
        keyboard: "tel",
    },
    {
        key: "billingAlt",
        label: "Alternate phone",
        hint: "Optional",
        span: { base: 2, sm: 3 },
        type: "tel",
        keyboard: "tel",
    },
    {
        key: "billingEmail",
        label: "Email",
        span: { base: 2, sm: 6 },
        type: "email",
        keyboard: "email",
        autoCapitalize: "none",
    },
];

/**
 * Only asked for when the bed is going somewhere other than the billing address - a gift, a
 * college dorm, a second home.
 */
export const CustomerDeliveryFields: CustomerSheetField[] = [
    {
        key: "deliveryName",
        label: "Who is receiving it?",
        span: { base: 2, sm: 6 },
        autoCapitalize: "words",
    },
    {
        key: "deliveryAddress",
        label: "Delivery street address",
        span: { base: 2, sm: 6 },
        autoCapitalize: "words",
    },
    { key: "deliveryUnit", label: "Unit #", hint: "Optional", span: { base: 1, sm: 2 } },
    { key: "deliveryFloor", label: "Floor", hint: "Optional", span: { base: 1, sm: 2 } },
    { key: "deliverySuite", label: "Suite #", hint: "Optional", span: { base: 2, sm: 2 } },
    { key: "deliveryCity", label: "City", span: { base: 2, sm: 3 }, autoCapitalize: "words" },
    {
        key: "deliveryState",
        label: "State",
        span: { base: 1, sm: 1 },
        autoCapitalize: "characters",
    },
    { key: "deliveryZip", label: "ZIP code", span: { base: 1, sm: 2 }, keyboard: "tel" },
    {
        key: "deliveryCell",
        label: "Phone at that address",
        hint: "Optional",
        span: { base: 2, sm: 3 },
        type: "tel",
        keyboard: "tel",
    },
    {
        key: "deliveryAlt",
        label: "Alternate phone",
        hint: "Optional",
        span: { base: 2, sm: 3 },
        type: "tel",
        keyboard: "tel",
    },
];

/** Who invited the customer, so they get the credit. */
export const CustomerReferralField: CustomerSheetField = {
    key: "referralName",
    label: "Who sent you?",
    hint: "The student or family who invited you, so they get the credit",
    span: { base: 2, sm: 6 },
    autoCapitalize: "words",
};

const DELIVERY_KEYS = [...CustomerDeliveryFields.map((f) => f.key), "deliveryEmail"] as const;

const BILLING_KEYS = [...CustomerBillingFields.map((f) => f.key), "referralName"] as const;

/**
 * What the customer details sheet saves, or why it can't yet.
 * @param orderId The order.
 * @param form What the customer typed.
 * @param elsewhere True when it is delivered somewhere other than the billing address.
 * @returns The tidied changes, or the message to show.
 */
export const CustomerSheetChanges = (
    orderId: number | undefined,
    form: Order,
    elsewhere: boolean
): { changes: Order } | { problem: string } => {
    if (!(form.billingFirstName ?? "").trim() || !(form.billingLastName ?? "").trim())
        return { problem: "Please enter your first and last name." };

    if (elsewhere && !(form.deliveryAddress ?? "").trim())
        return { problem: "Please enter the delivery address." };

    // Delivering to the billing address leaves the sheet's delivery block empty, as the paper
    // form expects, so any address typed and then abandoned is cleared.
    const delivery = Object.fromEntries(
        DELIVERY_KEYS.map((key) => [key, elsewhere ? ((form[key] as string | null) ?? "") : ""])
    );
    const billing = Object.fromEntries(
        BILLING_KEYS.map((key) => [key, (form[key] as string | null) ?? ""])
    );

    return {
        changes: NormalizeCustomer({
            id: orderId,
            deliverySameAsBilling: !elsewhere,
            ...delivery,
            ...billing,
        }),
    };
};
