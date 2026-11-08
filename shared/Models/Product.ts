import type { ProductDeliveryOption } from "./ProductDeliveryOption";
import type { ProductOption } from "./ProductOption";
import type { ProductVariant } from "./ProductVariant";

/**
 * The stat-sheet column an item counts in. Every category says which one its items count in;
 * it also decides the warranty default and which items the receipt email treats as mattresses.
 */
export type StatColumn =
    | "Mattress"
    | "AdjustableBase"
    | "Pillow"
    | "Sheets"
    | "MattressProtector"
    | "Frame"
    | "BeanBagChair"
    | "Misc";

export type Product = {
    id?: number;
    /** The territory whose catalog it's in - every territory has its own. */
    territoryId?: number | null;
    territoryName?: string | null;
    /** Whether the signed-in user may change it. */
    canEdit?: boolean;
    name?: string;
    brand?: string;
    /** The name of the category it's listed under, one of its territory's. */
    category?: string;
    /** The stat-sheet column its category counts in (returned, not saved). */
    statColumn?: StatColumn;
    notes?: string | null;
    sortOrder?: number;
    isActive?: boolean;
    trackInventory?: boolean;
    /** Whether the product comes with a manufacturer warranty. */
    hasWarranty?: boolean;
    /** How long the warranty lasts, e.g. "10 years". */
    warrantyLength?: string | null;
    /** A sale on every size, as a percent off; a size can have its own instead. */
    saleDiscountPercent?: number | null;
    /** A sale on every size, as a fixed amount off each item. */
    saleDiscountAmount?: number | null;
    /** The sale on the product as a whole, as the server works it out (returned, not saved). */
    effectiveSalePercent?: number | null;
    /** The sale on the product as a whole, amount off each (returned, not saved). */
    effectiveSaleAmount?: number | null;
    /** Choices the rep makes beyond size, such as Color. */
    options?: ProductOption[];
    variants?: ProductVariant[];
    deliveryOptions?: ProductDeliveryOption[];
};

/** A product copied from another territory's catalog. */
export type ProductCopyResult = {
    product?: Product | null;
    /** Delivery options added along with it, and bundled items left out. */
    notes?: string[];
};
