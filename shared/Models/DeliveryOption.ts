export type DeliveryOption = {
    id?: number;
    /** The territory whose catalog it's in - every territory has its own. */
    territoryId?: number | null;
    territoryName?: string | null;
    /** Whether the signed-in user may change it. */
    canEdit?: boolean;
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
