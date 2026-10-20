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

/** One event's headline figures, for the overview of every event. */
export type EventTally = {
    eventId?: number;
    organization?: string | null;
    eventDate?: string | null;
    isActive?: boolean;
    completedOrderCount?: number;
    mattressAndBaseCount?: number;
    netSales?: number;
    totalSales?: number;
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
    /** The catalog's products that have sold the fewest units, fewest first. All events only. */
    worstProducts?: ProductTally[];
    repTotals?: RepTally[];
    /** Each event's headline figures, newest first; only in the overview of every event. */
    events?: EventTally[];
};

export type SaleMoment = {
    at?: string;
    total?: number;
};
