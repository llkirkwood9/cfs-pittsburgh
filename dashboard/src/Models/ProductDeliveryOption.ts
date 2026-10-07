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
    /** This product has its own sale on the option instead of the option's own. */
    hasOwnSale?: boolean;
    saleDiscountPercent?: number | null;
    saleDiscountAmount?: number | null;
    /** The option's own sale (read only), which applies unless the product has its own. */
    optionSaleDiscountPercent?: number | null;
    optionSaleDiscountAmount?: number | null;
};
