import type { ProductDeliveryOption } from "./ProductDeliveryOption";
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
    variants?: ProductVariant[];
    deliveryOptions?: ProductDeliveryOption[];
};
