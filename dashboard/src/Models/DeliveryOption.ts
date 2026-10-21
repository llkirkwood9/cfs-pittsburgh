export type DeliveryOption = {
    id?: number;
    /** The territory it's offered in; null for a global option offered everywhere. */
    territoryId?: number | null;
    territoryName?: string | null;
    /** Whether the signed-in user may change it - a manager can't change global options. */
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
