export type DeliveryOption = {
    id?: number;
    name?: string;
    price?: number;
    isTaxable?: boolean;
    isTakeWith?: boolean;
    showOnSalesSheet?: boolean;
    sortOrder?: number;
    isActive?: boolean;
    /** A sale on this option, taken off whenever it is added to an order. */
    saleDiscountPercent?: number | null;
    saleDiscountAmount?: number | null;
};
