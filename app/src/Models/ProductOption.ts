/** One choice for a selection, such as "Gray" for Color. */
export type ProductOptionChoice = {
    id?: number;
    name?: string;
    /** Added to the size's price when chosen (negative takes off); null for no change. */
    priceAdjustment?: number | null;
    sortOrder?: number;
    isActive?: boolean;
};

/** A choice the rep makes for a product beyond its size, such as a sheet set's Color. */
export type ProductOption = {
    id?: number;
    name?: string;
    sortOrder?: number;
    /** Whether a choice must be picked before the item can be added. */
    isRequired?: boolean;
    /** Whether stock is counted for each choice (and combination with other counted ones). */
    tracksStock?: boolean;
    choices?: ProductOptionChoice[];
};

/** Units on hand of a size in one combination of counted choices. */
export type ChoiceStock = {
    /** The combination, e.g. "5:12|6:31". */
    stockKey?: string;
    /** Its choices, e.g. "Gray / Striped". */
    label?: string;
    quantityOnHand?: number;
};

/** A selection made for an item on an order. */
export type LineChoice = {
    optionId?: number;
    choiceId?: number;
    /** The selection's name when sold, e.g. "Color". */
    option?: string;
    /** The choice's name when sold, e.g. "Gray". */
    choice?: string;
    priceAdjustment?: number | null;
};

/** The selections for one item that comes inside a bundle. */
export type IncludedChoices = {
    componentVariantId?: number;
    choices?: LineChoice[];
};
