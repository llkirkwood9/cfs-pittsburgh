import type { ProductCategory } from "./Product";

export type InventoryItem = {
    productVariantId?: number;
    productId?: number;
    productName?: string;
    brand?: string;
    category?: ProductCategory;
    size?: string;
    configuration?: string | null;
    quantityOnHand?: number;
    /** Which combination of counted choices this row is; empty for stock kept per size. */
    stockKey?: string;
    /** The combination's choices, e.g. "Gray / Striped"; empty for stock kept per size. */
    choices?: string;
    soldAtEvent?: number | null;
    openingCountAtEvent?: number | null;
    openingCountedAt?: string | null;
    openingCountedBy?: string | null;
    countedAtEvent?: number | null;
    countedAt?: string | null;
    countedBy?: string | null;
    expectedAtCount?: number | null;
    lastChangedAt?: string | null;
};
