export type Territory = {
    id?: number;
    name?: string;
    isActive?: boolean;
    userCount?: number;
    eventCount?: number;
    productCount?: number;
    /** Organization of its active event, if one is running. */
    activeEvent?: string | null;
    createdAt?: string;
};

/** One territory's row on the dashboard's side-by-side comparison. */
export type TerritoryStats = {
    territoryId?: number;
    territoryName?: string;
    isActive?: boolean;
    activeEvent?: string | null;
    eventCount?: number;
    completedOrderCount?: number;
    totalSales?: number;
    netSales?: number;
    averageSale?: number;
    mattressCount?: number;
    adjustableBaseCount?: number;
    outstandingBalance?: number;
};
