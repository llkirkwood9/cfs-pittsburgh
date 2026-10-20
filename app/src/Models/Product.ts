import type { ProductDeliveryOption } from "./ProductDeliveryOption";
import type { ProductOption } from "./ProductOption";
import type { ProductVariant } from "./ProductVariant";

export type ProductCategory =
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
    /** The territory it's sold in; null for a global item sold everywhere. */
    territoryId?: number | null;
    territoryName?: string | null;
    /** Whether the signed-in user may change it - a manager can't change global items. */
    canEdit?: boolean;
    name?: string;
    brand?: string;
    category?: ProductCategory;
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
    /** Choices the rep makes beyond size, such as Color. */
    options?: ProductOption[];
    variants?: ProductVariant[];
    deliveryOptions?: ProductDeliveryOption[];
};
