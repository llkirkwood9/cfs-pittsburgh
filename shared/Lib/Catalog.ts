import { FormatCurrency } from "./Format";
import { DiscountText, HasDiscount, SaleFor } from "./Pricing";
import { LowestPrice } from "./ProductSort";
import type { Product, ProductCategory } from "../Models/Product";
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

/** Full, plural category names for headings, e.g. on the inventory sheet. */
export const CategoryNames: Record<ProductCategory, string> = {
    Mattress: "Mattresses",
    AdjustableBase: "Adjustable Bases",
    Pillow: "Pillows",
    Sheets: "Sheets",
    MattressProtector: "Mattress Protectors",
    Frame: "Frames",
    BeanBagChair: "Bean Bag Chairs",
    Misc: "Other",
};

/** Each category's short name, for tabs and filters. */
export const CategoryShortNames: Record<ProductCategory, string> = {
    Mattress: "Mattresses",
    AdjustableBase: "Bases",
    Pillow: "Pillows",
    Sheets: "Sheets",
    MattressProtector: "Protectors",
    Frame: "Frames",
    BeanBagChair: "Bean Bags",
    Misc: "Other",
};

/** The bundle picker's category tabs, bases first because that is the usual thing to include. */
export const BundleCategories: ProductCategory[] = [
    "AdjustableBase",
    ...(Object.keys(CategoryShortNames) as ProductCategory[]).filter((c) => c !== "AdjustableBase"),
];

/** A tab on the Catalog screen: every product, one category, or the delivery or financing lists. */
export type CatalogTab = ProductCategory | "All" | "Delivery" | "Financing";

/**
 * Whether a catalog tab lists products.
 * @param tab The tab.
 * @returns False for the delivery and financing lists.
 */
export const IsProductTab = (tab: CatalogTab): tab is ProductCategory | "All" =>
    tab !== "Delivery" && tab !== "Financing";

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
        if (tab !== "All" && IsProductTab(tab) && product.category !== tab) return false;
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
 * A blank product for New product: in the territory in view, and in the tab's category.
 * @param tab The tab New product was pressed on.
 * @param territoryId The territory in view.
 * @returns The product to edit.
 */
export const NewProduct = (tab: ProductCategory | "All", territoryId: number | null): Product => ({
    territoryId,
    category: tab === "All" ? "Misc" : tab,
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
