import {
    AddressLines,
    InitialsFor,
    IsAcknowledged,
    PaymentMethodLabels,
    RequiredTerms,
    SortLinesForPrint,
} from "./Orders";
import type { SalesTermKey } from "../Models/GeneralSettings";
import type { Order, OrderStatus } from "../Models/Order";
import type { PaymentMethod } from "../Models/OrderPayment";

/**
 * What the checkout table says when another device closes the order on screen.
 * @param orderNumber The order's number.
 * @param status What the order is now; nothing when it is gone.
 * @returns The message.
 */
export const ClosedElsewhereText = (
    orderNumber: number | string | null | undefined,
    status: OrderStatus | null | undefined
): string => {
    const what =
        status === "Completed"
            ? "completed"
            : status === "Voided"
              ? "voided"
              : status === "Draft"
                ? "sent back to the sales floor"
                : "removed";
    return `Order #${orderNumber} was ${what} on another device.`;
};

/** Where an order stands with the customer's acknowledgements, for the checkout panel. */
export type AcknowledgementState = {
    /** Completed or voided: nothing more to change. */
    closed: boolean;
    signed: boolean;
    /** Whether the order needs the customer to confirm their details. */
    detailsNeeded: boolean;
    /** The details are confirmed, or not needed. */
    confirmed: boolean;
    /** Every statement other than the details is initialled. */
    initialled: boolean;
    /** Those initials, e.g. "AB, AB". */
    initialsText: string;
    /** Initialled and signed: the sale can complete. */
    acknowledged: boolean;
};

/**
 * Where an order stands with the customer's acknowledgements. Only the statements the order
 * needs count: a take-home sale skips some of them.
 * @param order The order, if one is open.
 * @returns The state.
 */
export const AcknowledgementStateOf = (order: Order | null): AcknowledgementState => {
    const required = order ? RequiredTerms(order) : [];
    const detailsNeeded = required.includes("customerInfo");
    const initialsNeeded = required.filter((key) => key !== "customerInfo");
    return {
        closed: order?.status === "Completed" || order?.status === "Voided",
        signed: Boolean(order?.customerSignature),
        detailsNeeded,
        confirmed: !detailsNeeded || Boolean(order?.customerInfoInitials),
        initialled: Boolean(order) && initialsNeeded.every((key) => InitialsFor(order!, key)),
        initialsText: order ? initialsNeeded.map((key) => InitialsFor(order, key)).join(", ") : "",
        acknowledged: order ? IsAcknowledged(order) : false,
    };
};

/**
 * The acknowledgement checks' wording.
 * @param order The order.
 * @param state Its acknowledgement state.
 * @returns The details check's and the initials check's text.
 */
export const AcknowledgementChecks = (
    order: Order,
    state: AcknowledgementState
): { details: string; initials: string } => ({
    details: state.detailsNeeded
        ? `Details confirmed${state.confirmed ? ` (${order.customerInfoInitials})` : ""}`
        : "Details not needed",
    initials: `Initials${state.initialled && state.initialsText ? ` (${state.initialsText})` : ""}`,
});

/**
 * The customer's billing name and address on one line, for the checkout panel.
 * @param order The order.
 * @returns The line.
 */
export const BillingSummaryText = (order: Order): string =>
    `${order.billingName || "No name yet"}${order.billingAddress ? ` · ${order.billingAddress}` : ""}${
        order.billingCity ? `, ${order.billingCity}` : ""
    }${order.billingState ? ` ${order.billingState}` : ""}${order.billingZip ? ` ${order.billingZip}` : ""}`;

/**
 * Where the order is delivered when it isn't the billing address, on one line.
 * @param order The order.
 * @returns The line, or null when it goes to the billing address.
 */
export const DeliverToText = (order: Order): string | null =>
    (order.deliverySameAsBilling ?? true)
        ? null
        : [
              order.deliveryName,
              order.deliveryAddress,
              order.deliveryCity,
              order.deliveryState,
              order.deliveryZip,
          ]
              .filter(Boolean)
              .join(", ");

const PAYMENT_ICONS: Record<PaymentMethod, string> = {
    Cash: "fa-solid fa-money-bill-wave",
    Check: "fa-solid fa-money-check",
    VisaMc: "fa-solid fa-credit-card",
    Financing: "fa-solid fa-file-signature",
    Layaway: "fa-solid fa-box-archive",
};

/**
 * The payment methods the checkout table offers, in PaymentMethodLabels' order - cash and check
 * first: they are the common case at a school fundraiser and carry no card fee.
 */
export const PaymentMethods: { key: PaymentMethod; label: string; icon: string }[] = (
    Object.keys(PaymentMethodLabels) as PaymentMethod[]
).map((key) => ({ key, label: PaymentMethodLabels[key], icon: PAYMENT_ICONS[key] }));

/** The order field that holds each statement's initials. */
export type InitialsKey =
    "customerInfoInitials" | "warrantyInitials" | "dropShipInitials" | "advisoryInitials";

/** Which of the order's initials each statement takes, in signing order. */
export const AcknowledgementSteps: { term: SalesTermKey; key: InitialsKey }[] = [
    { term: "customerInfo", key: "customerInfoInitials" },
    { term: "warranty", key: "warrantyInitials" },
    { term: "dropShip", key: "dropShipInitials" },
    { term: "advisory", key: "advisoryInitials" },
];

/** Everything the customer confirms on the details step. */
export type DetailsSummary = {
    billing: string[];
    /** Null when it goes to the billing address. */
    delivery: string[] | null;
    phones: string;
    /** Each item with the way it is leaving. */
    items: { id?: number; name: string; how: string }[];
};

/**
 * Everything the customer is confirming on the first step: who they are, how to reach them, where
 * the order goes and how each item is getting there.
 * @param order The order.
 * @returns The summary.
 */
export const DetailsSummaryOf = (order: Order): DetailsSummary => {
    const billing = AddressLines({
        address: order.billingAddress,
        unit: order.billingUnit,
        floor: order.billingFloor,
        suite: order.billingSuite,
        city: order.billingCity,
        state: order.billingState,
        zip: order.billingZip,
    });
    const delivery = order.deliverySameAsBilling
        ? null
        : AddressLines({
              address: order.deliveryAddress,
              unit: order.deliveryUnit,
              floor: order.deliveryFloor,
              suite: order.deliverySuite,
              city: order.deliveryCity,
              state: order.deliveryState,
              zip: order.deliveryZip,
          });
    const phones = [order.billingCell, order.billingAlt].filter(Boolean).join(" / ");

    // Each item with the way it is leaving: its shipping row, or Take With.
    const lines = SortLinesForPrint(order.lines ?? []);
    const items = lines
        .filter((l) => l.lineType === "Product" || l.lineType === "Custom")
        .map((item) => {
            const methods = lines
                .filter((l) => l.parentLineId === item.id && l.lineType === "Delivery")
                .map((l) => l.description);
            return {
                id: item.id,
                name: `${item.quantity && item.quantity > 1 ? `${item.quantity} x ` : ""}${item.description}`,
                how: methods.length
                    ? methods.join(" + ")
                    : item.takeWith
                      ? "Take With"
                      : "Drop Ship",
            };
        });

    return { billing, delivery, phones, items };
};
