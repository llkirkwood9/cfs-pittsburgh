import type { OrderStatus } from "./Order";

export type OrderSummary = {
    id?: number;
    eventId?: number;
    /** The territory of the event it was taken at. */
    territoryId?: number | null;
    territoryName?: string | null;
    orderNumber?: number;
    eventOrganization?: string | null;
    eventDate?: string | null;
    status?: OrderStatus;
    draftLabel?: string | null;
    billingName?: string | null;
    cfsRepName?: string | null;
    billingCell?: string | null;
    billingAlt?: string | null;
    billingEmail?: string | null;
    lineCount?: number;
    subtotal?: number;
    total?: number;
    balanceDue?: number;
    createdAt?: string;
    submittedAt?: string | null;
    completedAt?: string | null;
    updatedAt?: string;
};
