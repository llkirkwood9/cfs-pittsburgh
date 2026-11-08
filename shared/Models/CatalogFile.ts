/** A delivery option in a catalog file. */
export interface CatalogDeliveryOption {
    /** The territory it belongs to, by name; blank when global. */
    territory?: string | null;
    name?: string;
    price?: number;
    isTaxable?: boolean;
    isTakeWith?: boolean;
    showOnSalesSheet?: boolean;
    isActive?: boolean;
}

/** An item a size includes, named rather than numbered. */
export interface CatalogComponent {
    /** The territory it belongs to, by name; blank when global. */
    territory?: string | null;
    brand?: string;
    name?: string;
    size?: string;
    configuration?: string | null;
    quantity?: number;
}

/** A size in a catalog file. */
export interface CatalogVariant {
    size?: string;
    configuration?: string | null;
    price?: number | null;
    isActive?: boolean;
    excludeFromInventory?: boolean;
    hasOwnSale?: boolean;
    saleDiscountPercent?: number | null;
    saleDiscountAmount?: number | null;
    includes?: CatalogComponent[] | null;
}

/** A selection in a catalog file. */
export interface CatalogOption {
    name?: string;
    isRequired?: boolean;
    tracksStock?: boolean;
    choices?: { name?: string; priceAdjustment?: number | null }[];
}

/** A product in a catalog file. */
export interface CatalogProduct {
    /** The territory it belongs to, by name; blank when global. */
    territory?: string | null;
    name?: string;
    brand?: string;
    category?: string;
    notes?: string | null;
    sortOrder?: number;
    isActive?: boolean;
    trackInventory?: boolean;
    saleDiscountPercent?: number | null;
    saleDiscountAmount?: number | null;
    variants?: CatalogVariant[];
    deliveryOptions?: { name?: string; priceOverride?: number | null; isDefault?: boolean }[];
    options?: CatalogOption[] | null;
}

/** The catalog as a file a system admin downloads and restores. */
export interface CatalogFile {
    format?: string;
    version?: number;
    exportedAt?: string;
    deliveryOptions?: CatalogDeliveryOption[];
    products?: CatalogProduct[];
    /** Missing from files made before financing options were exported. */
    financeOptions?: { name?: string; isActive?: boolean; territory?: string | null }[];
}

/** How a catalog file is restored. */
export type CatalogImportMode = "update" | "replace";

/** What a restore did. */
export interface CatalogImportResult {
    productsAdded: number;
    productsUpdated: number;
    productsRemoved: number;
    deliveryOptionsAdded: number;
    deliveryOptionsUpdated: number;
    deliveryOptionsRemoved: number;
    financeOptionsAdded: number;
    financeOptionsUpdated: number;
    financeOptionsRemoved: number;
    warnings: string[];
}
