import { FormatCurrency } from "./ModelHelpers";
import type { OrderLine } from "../Models/OrderLine";
import type { Product } from "../Models/Product";
import type { LineChoice, ProductOption } from "../Models/ProductOption";
import type { ProductVariant } from "../Models/ProductVariant";

/** A discount: a percent off, or a fixed amount off each item. At most one is set. */
export type Discount = { percent: number | null; amount: number | null };

/**
 * A discount tidied the way the server stores it: a positive percent wins, else a positive
 * amount, else nothing.
 * @param percent Percent off.
 * @param amount Amount off each item.
 * @returns The discount.
 */
export const CleanDiscount = (percent?: number | null, amount?: number | null): Discount =>
    (percent ?? 0) > 0
        ? { percent: Math.min(percent!, 100), amount: null }
        : (amount ?? 0) > 0
          ? { percent: null, amount: amount! }
          : { percent: null, amount: null };

/**
 * The catalog sale on a size: its own when it has one, otherwise its product's. Matches the
 * server, which applies it when the item goes on an order.
 * @param product The product.
 * @param variant The size.
 * @returns The sale, or no discount.
 */
export const SaleFor = (product: Product, variant?: ProductVariant): Discount =>
    variant?.hasOwnSale
        ? CleanDiscount(variant.saleDiscountPercent, variant.saleDiscountAmount)
        : CleanDiscount(product.saleDiscountPercent, product.saleDiscountAmount);

/** Whether any size of a product is on sale. */
export const OnSale = (product: Product): boolean =>
    (product.variants ?? []).some((v) => HasDiscount(SaleFor(product, v)));

/** Whether a discount takes anything off. */
export const HasDiscount = (discount: Discount): boolean =>
    discount.percent !== null || discount.amount !== null;

/**
 * A price with a discount taken off, never below zero.
 * @param price The price.
 * @param discount The discount.
 * @returns The discounted price.
 */
export const ApplyDiscount = (price: number, discount: Discount): number => {
    const off =
        discount.percent !== null
            ? price * (discount.percent / 100)
            : discount.amount !== null
              ? discount.amount
              : 0;
    return Math.max(0, price - off);
};

/**
 * A discount as text, such as "20%" or "$300".
 * @param discount The discount.
 * @returns The text, or "" for none.
 */
export const DiscountText = (discount: Discount): string =>
    discount.percent !== null
        ? `${Number(discount.percent.toFixed(2))}%`
        : discount.amount !== null
          ? FormatCurrency(discount.amount).replace(/\.00$/, "")
          : "";

/**
 * Everything taken off an order line, such as "20%" for a sale, "$100" for the rep's discount,
 * or "20% + $100" for both.
 * @param line The order line.
 * @returns The text, or "" for none.
 */
export const LineDiscountText = (line: OrderLine): string =>
    [
        DiscountText(CleanDiscount(line.saleDiscountPercent, line.saleDiscountAmount)),
        DiscountText(CleanDiscount(line.discountPercent, line.discountAmount)),
    ]
        .filter(Boolean)
        .join(" + ");

/** Whether a line has any discount at all. */
export const LineHasDiscount = (line: OrderLine): boolean => LineDiscountText(line) !== "";

/**
 * Selections as one line of text, such as "Color: Gray, Pattern: Striped".
 * @param choices The selections.
 * @returns The text, or "" for none.
 */
export const ChoicesText = (choices?: LineChoice[] | null): string =>
    (choices ?? [])
        .filter((c) => c.option && c.choice)
        .map((c) => `${c.option}: ${c.choice}`)
        .join(", ");

/**
 * The selections whose stock is counted, in the order the server builds stock keys.
 * @param product The product.
 * @returns The counted selections.
 */
export const CountedOptions = (product: Product): ProductOption[] =>
    product.trackInventory
        ? (product.options ?? [])
              .filter((o) => o.tracksStock && (o.choices ?? []).length > 0)
              .sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
        : [];

/**
 * The stock key for the choices picked, matching the server: counted selections as
 * "selection:choice", by selection id, joined with "|". Null while a counted one is unpicked.
 * @param product The product.
 * @param picked Selection id to choice id.
 * @returns The key ("" when nothing is counted), or null when incomplete.
 */
export const StockKeyFor = (product: Product, picked: Record<number, number>): string | null => {
    const parts: string[] = [];
    for (const option of CountedOptions(product)) {
        const choice = picked[option.id ?? 0];
        if (choice === undefined) return null;
        parts.push(`${option.id}:${choice}`);
    }
    return parts.join("|");
};

/**
 * Units on hand of a size for the choices picked, or null when the product isn't tracked or a
 * counted selection hasn't been picked yet.
 * @param product The product.
 * @param variant The size.
 * @param picked Selection id to choice id.
 * @returns The count, or null.
 */
export const StockFor = (
    product: Product,
    variant: ProductVariant | undefined,
    picked: Record<number, number>
): number | null => {
    if (!product.trackInventory || !variant) return null;
    const key = StockKeyFor(product, picked);
    if (key === null) return null;
    if (key === "") return variant.quantityOnHand ?? 0;
    return variant.stocks?.find((s) => s.stockKey === key)?.quantityOnHand ?? 0;
};

/**
 * What the choices picked add to the price.
 * @param product The product.
 * @param picked Selection id to choice id.
 * @returns The total price change.
 */
export const ChoicesPriceChange = (product: Product, picked: Record<number, number>): number =>
    (product.options ?? []).reduce((sum, option) => {
        const choice = option.choices?.find((c) => c.id === picked[option.id ?? 0]);
        return sum + (choice?.priceAdjustment ?? 0);
    }, 0);
