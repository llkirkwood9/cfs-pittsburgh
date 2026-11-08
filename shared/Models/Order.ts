import type { SalesTerm, SalesTermKey } from "./GeneralSettings";
import type { OrderLine } from "./OrderLine";
import type { OrderPayment } from "./OrderPayment";

export type OrderStatus = "Draft" | "AwaitingCheckout" | "Completed" | "Voided";

export type Order = {
    id?: number;
    eventId?: number;
    /** The territory of the event it was taken at; its settings print on the sheet. */
    territoryId?: number | null;
    territoryName?: string | null;
    orderNumber?: number;
    status?: OrderStatus;
    draftLabel?: string | null;

    saleDate?: string;
    organization?: string | null;
    advertisingSource?: string | null;
    referralName?: string | null;
    cfsRepName?: string | null;

    /** First and last name together, as printed; kept in step by the API. */
    billingName?: string | null;
    billingFirstName?: string | null;
    billingLastName?: string | null;
    billingAddress?: string | null;
    billingUnit?: string | null;
    billingFloor?: string | null;
    billingSuite?: string | null;
    billingCity?: string | null;
    billingState?: string | null;
    billingZip?: string | null;
    billingCell?: string | null;
    billingAlt?: string | null;
    billingEmail?: string | null;

    deliverySameAsBilling?: boolean;
    deliveryName?: string | null;
    deliveryAddress?: string | null;
    deliveryUnit?: string | null;
    deliveryFloor?: string | null;
    deliverySuite?: string | null;
    deliveryCity?: string | null;
    deliveryState?: string | null;
    deliveryZip?: string | null;
    deliveryCell?: string | null;
    deliveryAlt?: string | null;
    deliveryEmail?: string | null;

    comments?: string | null;
    salesTaxRate?: number;
    ccProcessingFeeRate?: number;
    applyCcProcessingFee?: boolean;
    /** Ticked at checkout to take the card fee off this order. */
    waiveCcProcessingFee?: boolean;
    subtotal?: number;
    taxAmount?: number;
    ccProcessingFee?: number;
    total?: number;
    amountPaid?: number;
    balanceDue?: number;

    customerInfoInitials?: string | null;
    warrantyInitials?: string | null;
    dropShipInitials?: string | null;
    advisoryInitials?: string | null;
    /** The wording the customer initialled, kept when the sale was completed. */
    terms?: SalesTerm[] | null;
    /** The statements this order needs initialled, from what is on it; the rest are skipped. */
    requiredTerms?: SalesTermKey[];
    customerSignatureName?: string | null;
    customerSignature?: string | null;
    signedDate?: string | null;
    receivedBy?: string | null;
    receivedDate?: string | null;

    createdByName?: string | null;
    completedByName?: string | null;
    createdAt?: string;
    submittedAt?: string | null;
    completedAt?: string | null;
    updatedAt?: string;

    lines?: OrderLine[];
    payments?: OrderPayment[];

    eventOrganization?: string | null;
};
