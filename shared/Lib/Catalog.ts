import type { ProductCategory } from "../Models/Product";
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
