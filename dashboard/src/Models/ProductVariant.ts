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
    components?: ProductVariantComponent[];
};
