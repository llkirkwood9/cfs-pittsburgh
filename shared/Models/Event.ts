export type Event = {
    id?: number;
    /** The territory it's held in. */
    territoryId?: number;
    territoryName?: string;
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
