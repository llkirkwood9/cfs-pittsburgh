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
