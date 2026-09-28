import type { ProductCategory } from "./Product";

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
