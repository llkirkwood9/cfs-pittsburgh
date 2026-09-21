import type { OrderLine } from "./OrderLine";
import type { OrderPayment } from "./OrderPayment";

export type OrderStatus = "Draft" | "AwaitingCheckout" | "Completed" | "Voided";

export type Order = {
    id?: number;
    eventId?: number;
    orderNumber?: number;
    status?: OrderStatus;
    draftLabel?: string | null;

    saleDate?: string;
    organization?: string | null;
    advertisingSource?: string | null;
    referralName?: string | null;
    cfsRepName?: string | null;

    billingName?: string | null;
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
    subtotal?: number;
    taxAmount?: number;
    ccProcessingFee?: number;
    total?: number;
    amountPaid?: number;
    balanceDue?: number;

    warrantyInitials?: string | null;
    dropShipInitials?: string | null;
    advisoryInitials?: string | null;
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
