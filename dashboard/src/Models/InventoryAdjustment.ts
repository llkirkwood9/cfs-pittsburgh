export type InventoryChangeKind = "Adjustment" | "Sale" | "Return";

export type InventoryAdjustment = {
    id?: number;
    productVariantId?: number;
    change?: number;
    setTo?: number;
    kind?: InventoryChangeKind;
    quantityAfter?: number;
    orderNumber?: number | null;
    userName?: string | null;
    note?: string | null;
    createdAt?: string;
};
