import type { ChoiceStock } from "./ProductOption";
import type { ProductVariantComponent } from "./ProductVariantComponent";

export type ProductVariant = {
    id?: number;
    productId?: number;
    size?: string;
    configuration?: string | null;
    price?: number | null;
    sortOrder?: number;
    isActive?: boolean;
    quantityOnHand?: number;
    /** Left out of a tracked product's inventory: not counted, and Take With isn't limited. */
    excludeFromInventory?: boolean;
    /** Whether this size has its own sale rather than the product's (none = left out of it). */
    hasOwnSale?: boolean;
    saleDiscountPercent?: number | null;
    saleDiscountAmount?: number | null;
    /** Stock per combination of counted choices, for products whose selections count stock. */
    stocks?: ChoiceStock[] | null;
    components?: ProductVariantComponent[];
};
