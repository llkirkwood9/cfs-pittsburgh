import type { OrderStatus } from "./Order";

export type OrderSummary = {
    id?: number;
    eventId?: number;
    orderNumber?: number;
    eventOrganization?: string | null;
    eventDate?: string | null;
    status?: OrderStatus;
    draftLabel?: string | null;
    billingName?: string | null;
    cfsRepName?: string | null;
    lineCount?: number;
    subtotal?: number;
    total?: number;
    balanceDue?: number;
    createdAt?: string;
    submittedAt?: string | null;
    completedAt?: string | null;
    updatedAt?: string;
};
