import { FormatCurrency } from "./Format";
import { DiscountText, HasDiscount, SaleFor } from "./Pricing";
import { LowestPrice } from "./ProductSort";
import type { Category } from "../Models/Category";
import type { Product, StatColumn } from "../Models/Product";
import { ActiveTerritories } from "../Models/Territory";
import type { Territory } from "../Models/Territory";
import type { ProductVariant } from "../Models/ProductVariant";

/**
 * Builds the label shown on a variant chip, e.g. "Queen - IMC61 Adjustable".
 * @param variant The variant to label.
 * @returns The display label.
 */
export const VariantLabel = (variant: ProductVariant): string =>
    variant.configuration ? `${variant.size} - ${variant.configuration}` : (variant.size ?? "");

/**
 * Whether a variant has no price on file and needs one keyed in by hand.
 * @param variant The variant to test.
 * @returns True when the price card reads "Inquire".
 */
export const NeedsPrice = (variant: ProductVariant): boolean =>
    variant.price === null || variant.price === undefined;

/** Each stat-sheet column's name, as the dashboard and the category form show it. */
export const StatColumnNames: Record<StatColumn, string> = {
    Mattress: "Mattresses",
    AdjustableBase: "Adjustable Bases",
    Pillow: "Pillows",
    Sheets: "Sheets",
    MattressProtector: "Mattress Protectors",
    Frame: "Frames",
    BeanBagChair: "Bean Bag Chairs",
    Misc: "Other",
};

/**
 * The categories of one territory's catalog, in tab order - or, with no territory, every
 * category name once, as a list of several territories' items shows them.
 * @param categories Every category in view, each territory's in tab order.
 * @param territoryId The territory, or null for every one in view.
 * @returns The categories.
 */
export const CategoriesFor = (
    categories: Category[],
    territoryId: number | null | undefined
): Category[] =>
    territoryId == null
        ? categories.filter((c, i) => categories.findIndex((o) => o.name === c.name) === i)
        : categories.filter((c) => c.territoryId === territoryId);

/**
 * The category names products are listed under, in the order the products come (the server
 * lists them in tab order), each once.
 * @param products The products.
 * @returns The names.
 */
export const CategoryOrder = (products: { category?: string }[]): string[] =>
    Array.from(new Set(products.map((p) => p.category ?? "")));

/**
 * The bundle picker's category tabs: those of the items on offer, in tab order, with any that
 * count as adjustable bases first, because a base is the usual thing to include.
 * @param products The items that can be included.
 * @returns The category names.
 */
export const BundleCategories = (products: Product[]): string[] => {
    const isBase = (name: string) =>
        products.some((p) => p.category === name && p.statColumn === "AdjustableBase");
    const order = CategoryOrder(products);
    return [...order.filter(isBase), ...order.filter((c) => !isBase(c))];
};

/** The tab that lists every product. */
export const AllTab = "All";

/** The Catalog screen's tabs that aren't a category's, keyed so no category name can clash. */
export const CatalogListTabs = {
    Delivery: "#delivery",
    Financing: "#financing",
    Categories: "#categories",
} as const;

/** A tab on the Catalog screen: every product, one category's, or one of the other lists. */
export type CatalogTab = string;

/**
 * Whether a catalog tab lists products.
 * @param tab The tab.
 * @returns False for the delivery, financing and category lists.
 */
export const IsProductTab = (tab: CatalogTab): boolean =>
    !(Object.values(CatalogListTabs) as string[]).includes(tab);

/**
 * The products a catalog tab shows: its category's (or all of them), matching the search by name
 * or brand.
 * @param products Every product.
 * @param tab The tab.
 * @param search What was typed.
 * @returns The matches, in the order given.
 */
export const CatalogMatches = (products: Product[], tab: CatalogTab, search: string): Product[] => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
        if (tab !== AllTab && IsProductTab(tab) && product.category !== tab) return false;
        if (!term) return true;
        return (
            (product.name ?? "").toLowerCase().includes(term) ||
            (product.brand ?? "").toLowerCase().includes(term)
        );
    });
};

/**
 * A product's price range for its catalog row, e.g. "$899.00 - $1,499.00".
 * @param product The product.
 * @returns The range, one price when every size costs the same, or "No prices set".
 */
export const PriceRangeText = (product: Product): string => {
    const low = LowestPrice(product);
    if (low === null) return "No prices set";

    const high = Math.max(
        ...(product.variants ?? [])
            .map((v) => v.price)
            .filter((price): price is number => price !== null && price !== undefined)
    );
    return low === high ? FormatCurrency(low) : `${FormatCurrency(low)} - ${FormatCurrency(high)}`;
};

/**
 * A product's sale badge on its catalog row.
 * @param product The product, which is on sale.
 * @returns e.g. "Sale 20% off", or "Sale on some sizes" when only some sizes have one.
 */
export const SaleBadgeText = (product: Product): string =>
    HasDiscount(SaleFor(product))
        ? `Sale ${DiscountText(SaleFor(product))} off`
        : "Sale on some sizes";

/**
 * A tracked product's stock for its catalog row: the units on hand across its counted sizes, and
 * how many sizes aren't counted. Counts are added as kept, so an oversold size (below zero) shows.
 * @param product The product.
 * @returns e.g. "Tracked - 14 on hand (2 not counted)".
 */
export const ProductStockSummary = (product: Product): string => {
    const variants = product.variants ?? [];
    const onHand = variants.reduce(
        (sum, v) =>
            sum +
            (v.excludeFromInventory
                ? 0
                : v.stocks
                  ? v.stocks.reduce((n, st) => n + (st.quantityOnHand ?? 0), 0)
                  : (v.quantityOnHand ?? 0)),
        0
    );
    const excluded = variants.filter((v) => v.excludeFromInventory).length;
    return `Tracked - ${onHand} on hand${excluded ? ` (${excluded} not counted)` : ""}`;
};

/**
 * How many delivery options a product offers, e.g. "1 delivery option".
 * @param product The product.
 * @returns The text.
 */
export const DeliveryCountText = (product: Product): string => {
    const count = product.deliveryOptions?.length ?? 0;
    return `${count} delivery option${count === 1 ? "" : "s"}`;
};

/**
 * A blank product for New product: in the territory in view, and in the tab's category - or,
 * from the All tab, the first one that counts as Other.
 * @param tab The tab New product was pressed on.
 * @param territoryId The territory in view.
 * @param categories That territory's categories.
 * @returns The product to edit.
 */
export const NewProduct = (
    tab: CatalogTab,
    territoryId: number | null,
    categories: Category[]
): Product => ({
    territoryId,
    category:
        tab !== AllTab && IsProductTab(tab)
            ? tab
            : (categories.find((c) => c.statColumn === "Misc") ?? categories[0])?.name,
    isActive: true,
    variants: [],
    deliveryOptions: [],
});

/**
 * The user's other territories, whose catalogs a new item can be copied from.
 * @param territories The user's territories.
 * @param territoryInView The territory in view.
 * @returns The active ones other than the one in view.
 */
export const CopySources = (
    territories: Territory[],
    territoryInView: number | null
): Territory[] => ActiveTerritories(territories).filter((t) => t.id !== territoryInView);
