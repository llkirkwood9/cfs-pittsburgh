/** A heading a territory's products are listed under, e.g. "Mattresses". */
export type Category = {
    id?: number;
    /** The territory whose catalog it's in - every territory has its own. */
    territoryId?: number | null;
    territoryName?: string | null;
    /** Whether the signed-in user may change it. */
    canEdit?: boolean;
    /** Shown on the tabs and as the inventory sheet's headings. */
    name?: string;
    sortOrder?: number;
    /** How many products are listed under it, archived ones included (returned, not saved). */
    productCount?: number;
};
