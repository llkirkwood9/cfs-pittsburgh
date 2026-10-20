export type Event = {
    id?: number;
    organization?: string;
    eventDate?: string;
    cartName?: string;
    inventoryNotes?: string | null;
    salesTaxRate?: number;
    ccProcessingFeeRate?: number;
    nextOrderNumber?: number;
    isActive?: boolean;
    createdAt?: string;
};
