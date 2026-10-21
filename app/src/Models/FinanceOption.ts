/** A kind of financing a customer can choose at checkout, kept in the catalog. */
export type FinanceOption = {
    id?: number;
    /** The territory it belongs to; null for a global option offered everywhere. */
    territoryId?: number | null;
    territoryName?: string | null;
    /** Whether the signed-in user may change it. */
    canEdit?: boolean;
    /** Shown at checkout and printed in the sales sheet's comments. */
    name?: string;
    sortOrder?: number;
    /** Offered at checkout. */
    isActive?: boolean;
};
