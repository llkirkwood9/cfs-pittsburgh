import { TakeWithBlocked } from "./Inventory";
import { SizeTracked } from "./Pricing";
import type { Product } from "../Models/Product";
import type { LineChoice, ProductOption } from "../Models/ProductOption";
import type { ProductVariant } from "../Models/ProductVariant";
import type { ProductVariantComponent } from "../Models/ProductVariantComponent";

/** Selection id to choice id. */
export type Picks = Record<number, number>;

/**
 * Units on hand for a size across all its choices, or null when the size isn't tracked (the
 * product does not track inventory, or the size is left out). Used for the "in stock" labels;
 * Take With checks the exact choices.
 * @param product The product.
 * @param variant The size.
 * @returns The count, or null.
 */
export const SizeStock = (product: Product, variant?: ProductVariant): number | null => {
    if (!SizeTracked(product, variant)) return null;
    if (variant?.stocks)
        return variant.stocks.reduce((sum, s) => sum + Math.max(0, s.quantityOnHand ?? 0), 0);
    return variant?.quantityOnHand ?? 0;
};

/**
 * Units on hand across every tracked size of a product, for the product tile.
 * @param product The product.
 * @returns The count, or null when no size is tracked.
 */
export const ProductStock = (product: Product): number | null =>
    (product.variants ?? []).some((v) => SizeTracked(product, v))
        ? (product.variants ?? []).reduce(
              (sum, v) => sum + Math.max(0, SizeStock(product, v) ?? 0),
              0
          )
        : null;

/**
 * A size's stock label: "4 in stock", "9 in stock in all" across its choices, or out of stock.
 * @param product The product.
 * @param variant The size.
 * @returns The label, or null when the size isn't tracked.
 */
export const SizeStockText = (product: Product, variant: ProductVariant): string | null => {
    if (!SizeTracked(product, variant)) return null;
    const stock = SizeStock(product, variant) ?? 0;
    return stock > 0
        ? `${stock} in stock${variant.stocks ? " in all" : ""}`
        : "Out of stock - ship only";
};

/**
 * What a bundle size includes, as one line, e.g. "2 x Pillow, Protector".
 * @param variant The size.
 * @returns The text, or "" when it includes nothing.
 */
export const IncludesText = (variant: ProductVariant): string =>
    (variant.components ?? [])
        .map((c) => ((c.quantity ?? 1) > 1 ? `${c.quantity} x ${c.productName}` : c.productName))
        .join(", ");

/**
 * Picks preset for a product: any selection with a single choice is chosen already.
 * @param product The product.
 * @returns The picks.
 */
export const PresetPicks = (product?: Product): Picks =>
    Object.fromEntries(
        (product?.options ?? [])
            .filter((o) => (o.choices ?? []).length === 1 && o.id && o.choices![0].id)
            .map((o) => [o.id!, o.choices![0].id!])
    );

/**
 * The first required selection without a choice yet, if any.
 * @param options The product's selections.
 * @param picked The picks so far.
 * @returns The selection, or undefined when everything required is picked.
 */
export const MissingPick = (
    options: ProductOption[] | undefined,
    picked: Picks
): ProductOption | undefined =>
    (options ?? []).find(
        (o) =>
            (o.isRequired || o.tracksStock) &&
            (o.choices ?? []).length > 0 &&
            picked[o.id ?? 0] === undefined
    );

/**
 * The picks as sent to the server.
 * @param picked The picks.
 * @returns One entry per selection.
 */
export const ToLineChoices = (picked: Picks): LineChoice[] =>
    Object.entries(picked).map(([optionId, choiceId]) => ({
        optionId: Number(optionId),
        choiceId,
    }));

/**
 * The delivery option to preselect: the current choice when it still works, otherwise the
 * product's default, otherwise the first option - skipping Take With when the size is short.
 * @param product The product.
 * @param onHand Units on hand for the chosen size and choices, or null when not tracked.
 * @param quantity Units being added.
 * @param currentId The option picked so far, if any.
 * @param notKept True when the size, or an item it includes, isn't kept at the cart.
 * @returns The delivery option id, or null.
 */
export const PickDelivery = (
    product: Product,
    onHand: number | null,
    quantity: number,
    currentId: number | null,
    notKept = false
): number | null => {
    const blocked = TakeWithBlocked(onHand, quantity, notKept);
    const usable = (product.deliveryOptions ?? []).filter((d) => !(d.isTakeWith && blocked));

    if (currentId !== null && usable.some((d) => d.deliveryOptionId === currentId))
        return currentId;

    const preferred = usable.find((d) => d.isDefault) ?? usable[0];
    return preferred?.deliveryOptionId ?? null;
};

/**
 * Whether a size isn't kept at the cart: it is left out of inventory, or it is a bundle that
 * includes such a size.
 * @param products The catalog, to look the included items up in.
 * @param product The product.
 * @param size The size.
 * @returns True when it can't go home today.
 */
export const NotKeptAtCart = (
    products: Product[],
    product: Product,
    size: ProductVariant | undefined
): boolean =>
    Boolean(
        (product.trackInventory && size?.excludeFromInventory) ||
        (size?.components ?? []).some((c) => {
            const included = products.find((p) => p.id === c.productId);
            const includedSize = included?.variants?.find((v) => v.id === c.componentVariantId);
            return Boolean(included?.trackInventory && includedSize?.excludeFromInventory);
        })
    );

/** An item a bundle includes, with its product. */
export type IncludedItem = { component: ProductVariantComponent; product: Product };

/**
 * The items a bundle size includes that have selections of their own, such as sheets in a color.
 * @param products The catalog.
 * @param variant The bundle size.
 * @returns The included items with choices to make.
 */
export const IncludedWithChoices = (
    products: Product[],
    variant: ProductVariant | undefined
): IncludedItem[] =>
    (variant?.components ?? [])
        .map((c) => ({ component: c, product: products.find((p) => p.id === c.productId) }))
        .filter(
            (x): x is IncludedItem =>
                Boolean(x.product) &&
                (x.product!.options ?? []).some((o) => (o.choices ?? []).length > 0)
        );

/**
 * Preset picks for each item a bundle size includes, by the included size's id - keeping any
 * already made.
 * @param products The catalog.
 * @param variant The bundle size.
 * @param current The picks made so far.
 * @returns The picks.
 */
export const IncludedPresetPicks = (
    products: Product[],
    variant: ProductVariant | undefined,
    current: Record<number, Picks> = {}
): Record<number, Picks> =>
    Object.fromEntries(
        (variant?.components ?? []).map((c) => [
            c.componentVariantId ?? 0,
            current[c.componentVariantId ?? 0] ??
                PresetPicks(products.find((p) => p.id === c.productId)),
        ])
    );
