export type InventoryChangeKind = "Adjustment" | "Sale" | "Return" | "Count" | "OpeningCount";

export type InventoryCount = {
    eventId?: number;
    phase?: "Start" | "End";
    note?: string;
    counts?: { productVariantId: number; stockKey?: string; counted: number }[];
};

export type InventoryAdjustment = {
    id?: number;
    productVariantId?: number;
    /** Which combination of counted choices; empty for stock kept per size. */
    stockKey?: string;
    change?: number;
    setTo?: number;
    kind?: InventoryChangeKind;
    quantityAfter?: number;
    orderNumber?: number | null;
    userName?: string | null;
    note?: string | null;
    createdAt?: string;
};
