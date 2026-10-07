import type { ProductCategory } from "./Product";
import type { IncludedChoices, LineChoice } from "./ProductOption";

export type OrderLineType = "Product" | "Delivery" | "Custom" | "Included";

export type OrderLine = {
    id?: number;
    lineType?: OrderLineType;
    category?: ProductCategory;
    productVariantId?: number | null;
    deliveryOptionId?: number | null;
    parentLineId?: number | null;
    brand?: string | null;
    size?: string | null;
    description?: string;
    quantity?: number;
    takeWith?: boolean;
    unitPrice?: number;
    discountPercent?: number | null;
    discountAmount?: number | null;
    /** The catalog sale when the item went on the order; the rep's discount comes off on top. */
    saleDiscountPercent?: number | null;
    saleDiscountAmount?: number | null;
    /** Selections such as Color: send the ids when adding; the names come back. */
    choices?: LineChoice[];
    /** Which stock the item draws from when its selections count stock. */
    stockKey?: string;
    /** When adding a bundle: the selections for the items it includes. */
    includedChoices?: IncludedChoices[];
    salePrice?: number;
    lineTotal?: number;
    includesAdjustableBase?: boolean;
    showOnSalesSheet?: boolean;
    isTaxable?: boolean;
    sortOrder?: number;
    /** Note printed under the item on the sales sheet, above its shipping rows. */
    notes?: string | null;
    /** On-hand count of the sold size; null when the product does not track inventory. */
    quantityOnHand?: number | null;
};
