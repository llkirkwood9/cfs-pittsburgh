/** A kind of financing a customer can choose at checkout, kept in the catalog. */
export type FinanceOption = {
    id?: number;
    /** Shown at checkout and printed in the sales sheet's comments. */
    name?: string;
    sortOrder?: number;
    /** Offered at checkout. */
    isActive?: boolean;
};
