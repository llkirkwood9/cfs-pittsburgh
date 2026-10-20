import type { ProductCategory } from "./Product";

export type ProductVariantComponent = {
    id?: number;
    componentVariantId?: number;
    quantity?: number;
    productId?: number;
    productName?: string;
    brand?: string;
    category?: ProductCategory;
    size?: string;
    configuration?: string | null;
};
