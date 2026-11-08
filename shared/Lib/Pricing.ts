import { FormatCurrency } from "./Format";
import type { DeliveryOption } from "../Models/DeliveryOption";
import type { OrderLine } from "../Models/OrderLine";
import type { Product } from "../Models/Product";
import type { ProductDeliveryOption } from "../Models/ProductDeliveryOption";
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

/**
 * The sale on a product's delivery option: the product's own when it has one, otherwise the
 * option's. Matches the server, which applies it when the shipping is added to an order.
 * @param delivery The product's entry for the option, if it offers it.
 * @param option The delivery option itself, when there is no product entry to read it from.
 * @returns The sale, or no discount.
 */
export const DeliverySaleFor = (
    delivery?: ProductDeliveryOption,
    option?: DeliveryOption
): Discount =>
    delivery?.hasOwnSale
        ? CleanDiscount(delivery.saleDiscountPercent, delivery.saleDiscountAmount)
        : CleanDiscount(
              delivery?.optionSaleDiscountPercent ?? option?.saleDiscountPercent,
              delivery?.optionSaleDiscountAmount ?? option?.saleDiscountAmount
          );

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
 * Whether a size's stock is counted: the product tracks inventory and the size isn't left out.
 * @param product The product.
 * @param variant The size.
 * @returns True when counted.
 */
export const SizeTracked = (product: Product, variant?: ProductVariant | null): boolean =>
    Boolean(product.trackInventory && variant && !variant.excludeFromInventory);

/**
 * The selections whose stock is counted, as the server says (countsStock), by selection id.
 * @param product The product.
 * @returns The counted selections.
 */
export const CountedOptions = (product: Product): ProductOption[] =>
    (product.options ?? []).filter((o) => o.countsStock).sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

/**
 * Units on hand of a size for the choices picked, or null when the size isn't tracked or a
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
    if (!variant || !SizeTracked(product, variant)) return null;
    const counted = CountedOptions(product);
    if (counted.some((o) => picked[o.id ?? 0] === undefined)) return null;
    if (counted.length === 0) return variant.quantityOnHand ?? 0;
    // The server lists each combination with the choices it's made of; find the one picked.
    const chosen = new Set(Object.values(picked));
    return (
        variant.stocks?.find((s) => (s.choiceIds ?? []).every((id) => chosen.has(id)))
            ?.quantityOnHand ?? 0
    );
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
