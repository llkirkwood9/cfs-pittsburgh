export type ProductTally = {
    description?: string;
    brand?: string | null;
    category?: string;
    quantity?: number;
    revenue?: number;
};

export type RepTally = {
    repName?: string;
    orderCount?: number;
    total?: number;
    averageSale?: number;
};

export type DashboardStats = {
    eventId?: number | null;
    organization?: string | null;
    eventDate?: string | null;

    mattressCount?: number;
    purpleCount?: number;
    helixCount?: number;
    adjustableBaseCount?: number;
    mattressProtectorCount?: number;
    pillowCount?: number;
    sheetCount?: number;
    frameCount?: number;
    beanBagChairCount?: number;
    miscCount?: number;
    mattressAndBaseCount?: number;

    totalSales?: number;
    netSales?: number;
    taxCollected?: number;
    ccProcessingFees?: number;
    averageSale?: number;
    outstandingBalance?: number;

    creditCardTotal?: number;
    cashTotal?: number;
    checkTotal?: number;
    financingTotal?: number;
    layawayTotal?: number;

    completedOrderCount?: number;
    draftOrderCount?: number;
    awaitingCheckoutCount?: number;
    voidedOrderCount?: number;

    /** Each completed sale's time and total, for the sales-by-hour chart. */
    sales?: SaleMoment[];
    topProducts?: ProductTally[];
    repTotals?: RepTally[];
};

export type SaleMoment = {
    at?: string;
    total?: number;
};
