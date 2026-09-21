export type ProductDeliveryOption = {
    id?: number;
    productId?: number;
    deliveryOptionId?: number;
    name?: string;
    price?: number;
    priceOverride?: number | null;
    isTaxable?: boolean;
    isTakeWith?: boolean;
    isDefault?: boolean;
};
