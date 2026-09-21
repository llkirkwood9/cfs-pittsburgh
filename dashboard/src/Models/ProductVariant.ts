export type ProductVariant = {
    id?: number;
    productId?: number;
    size?: string;
    configuration?: string | null;
    price?: number | null;
    includesAdjustableBase?: boolean;
    sortOrder?: number;
    isActive?: boolean;
};
