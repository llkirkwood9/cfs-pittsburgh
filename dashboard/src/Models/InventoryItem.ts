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
    soldAtEvent?: number | null;
    lastChangedAt?: string | null;
};
