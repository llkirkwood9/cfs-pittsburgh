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
    name?: string;
    brand?: string;
    category?: ProductCategory;
    notes?: string | null;
    sortOrder?: number;
    isActive?: boolean;
    trackInventory?: boolean;
    /** A sale on every size, as a percent off; a size can have its own instead. */
    saleDiscountPercent?: number | null;
    /** A sale on every size, as a fixed amount off each item. */
    saleDiscountAmount?: number | null;
    /** Choices the rep makes beyond size, such as Color. */
    options?: ProductOption[];
    variants?: ProductVariant[];
    deliveryOptions?: ProductDeliveryOption[];
};
