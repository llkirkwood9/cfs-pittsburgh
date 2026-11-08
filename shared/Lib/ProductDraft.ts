import {
    FollowSale,
    FromDraftOptions,
    FromSaleDraft,
    OptionsProblem,
    SaleProblem,
    ToDraftOptions,
    ToSaleDraft,
} from "./CatalogDrafts";
import type { DraftOption, SaleDraft } from "./CatalogDrafts";
import { ParseMoney } from "./Format";
import type { DeliveryOption } from "../Models/DeliveryOption";
import type { Product, ProductCategory } from "../Models/Product";
import type { ProductDeliveryOption } from "../Models/ProductDeliveryOption";
import type { ProductVariant } from "../Models/ProductVariant";

/** A size row being edited: the price as typed, and its own sale. */
export type DraftVariant = ProductVariant & { priceText: string; sale: SaleDraft };

/** A product being edited in the product form. */
export type ProductDraft = {
    name: string;
    brand: string;
    category: ProductCategory;
    notes: string;
    isActive: boolean;
    trackInventory: boolean;
    /** Ticked or unticked; null until then, so a new product follows its category. */
    warrantyChoice: boolean | null;
    warrantyLength: string;
    sale: SaleDraft;
    options: DraftOption[];
    variants: DraftVariant[];
    delivery: ProductDeliveryOption[];
    /** Each delivery choice's price override as typed, so a half-typed "12." isn't rounded away. */
    overrideText: Record<number, string>;
    /** This product's own sale on each delivery choice, or "follow" for the option's own. */
    deliverySales: Record<number, SaleDraft>;
};

/** A price as the form shows it: blank for none. */
const PriceText = (price?: number | null): string =>
    price === null || price === undefined ? "" : String(price);

/**
 * A product as the form starts out.
 * @param product The product, or a blank one for a new item.
 * @returns The draft.
 */
export const ToProductDraft = (product: Product): ProductDraft => ({
    name: product.name ?? "",
    brand: product.brand ?? "",
    category: product.category ?? "Misc",
    notes: product.notes ?? "",
    isActive: product.isActive ?? true,
    trackInventory: product.trackInventory ?? false,
    warrantyChoice: product.hasWarranty ?? null,
    warrantyLength: product.warrantyLength ?? "",
    sale: ToSaleDraft(product.saleDiscountPercent, product.saleDiscountAmount),
    options: ToDraftOptions(product.options),
    variants: (product.variants ?? []).map((v) => ({
        ...v,
        priceText: PriceText(v.price),
        sale: ToSaleDraft(v.saleDiscountPercent, v.saleDiscountAmount, !v.hasOwnSale),
    })),
    delivery: product.deliveryOptions ?? [],
    overrideText: Object.fromEntries(
        (product.deliveryOptions ?? []).map((d) => [
            d.deliveryOptionId ?? 0,
            PriceText(d.priceOverride),
        ])
    ),
    deliverySales: Object.fromEntries(
        (product.deliveryOptions ?? []).map((d) => [
            d.deliveryOptionId ?? 0,
            ToSaleDraft(d.saleDiscountPercent, d.saleDiscountAmount, !d.hasOwnSale),
        ])
    ),
});

/**
 * Whether the product has a manufacturer warranty: as ticked, or until then by its category -
 * mattresses and bases have one.
 * @param draft The draft.
 * @returns True when it has a warranty.
 */
export const DraftHasWarranty = (draft: ProductDraft): boolean =>
    draft.warrantyChoice ?? (draft.category === "Mattress" || draft.category === "AdjustableBase");

/**
 * The product's own sale on a delivery choice.
 * @param draft The draft.
 * @param deliveryOptionId The delivery option.
 * @returns The sale, following the option's own when not set.
 */
export const DraftDeliverySale = (draft: ProductDraft, deliveryOptionId?: number): SaleDraft =>
    draft.deliverySales[deliveryOptionId ?? 0] ?? FollowSale;

/**
 * A blank size row.
 * @param sortOrder Where it goes.
 * @returns The row.
 */
export const NewDraftVariant = (sortOrder: number): DraftVariant => ({
    size: "",
    configuration: "",
    priceText: "",
    sale: FollowSale,
    components: [],
    isActive: true,
    sortOrder,
});

/** An item picked to include in a size's bundle. */
export type BundlePick = {
    product: Product;
    variant: ProductVariant;
    quantity: number;
    /** Also add the matching size of the item to every other size of this configuration. */
    matchSizes: boolean;
};

/**
 * Adds a picked item to one size's bundle, and optionally to every other size of the same
 * configuration using the picked product's matching size. Sizes the item does not come in
 * are skipped rather than given a mismatched size.
 * @param variants The size rows.
 * @param index The size the item was picked for.
 * @param pick The pick.
 * @returns The new rows, and how many sizes were skipped.
 */
export const ApplyBundlePick = (
    variants: DraftVariant[],
    index: number,
    pick: BundlePick
): { variants: DraftVariant[]; skipped: number } => {
    const source = variants[index];
    const sameConfig = (v: DraftVariant) =>
        (v.configuration ?? "").trim().toLowerCase() ===
        (source.configuration ?? "").trim().toLowerCase();

    let skipped = 0;

    const next = variants.map((row, i) => {
        const isSource = i === index;
        if (!isSource && !(pick.matchSizes && sameConfig(row))) return row;

        const component = isSource
            ? pick.variant
            : pick.product.variants?.find(
                  (v) =>
                      (v.components ?? []).length === 0 &&
                      (v.size ?? "").toLowerCase() === (row.size ?? "").toLowerCase()
              );

        if (!component?.id) {
            skipped++;
            return row;
        }

        const others = (row.components ?? []).filter((c) => c.componentVariantId !== component.id);

        return {
            ...row,
            components: [
                ...others,
                {
                    componentVariantId: component.id,
                    quantity: pick.quantity,
                    productId: pick.product.id,
                    productName: pick.product.name,
                    brand: pick.product.brand,
                    category: pick.product.category,
                    size: component.size,
                    configuration: component.configuration,
                },
            ],
        };
    });

    return { variants: next, skipped };
};

/**
 * Offers a delivery option with the product, or stops offering it. A newly offered option has
 * no price override, and is the default when it's the only one.
 * @param draft The draft.
 * @param option The delivery option.
 * @returns The changes to the draft.
 */
export const ToggleDraftDelivery = (
    draft: ProductDraft,
    option: DeliveryOption
): Pick<ProductDraft, "delivery" | "overrideText"> => {
    if (draft.delivery.some((d) => d.deliveryOptionId === option.id))
        return {
            delivery: draft.delivery.filter((d) => d.deliveryOptionId !== option.id),
            overrideText: draft.overrideText,
        };

    return {
        delivery: [
            ...draft.delivery,
            {
                deliveryOptionId: option.id,
                name: option.name,
                price: option.price,
                priceOverride: null,
                isDefault: draft.delivery.length === 0,
            },
        ],
        overrideText: { ...draft.overrideText, [option.id ?? 0]: "" },
    };
};

/**
 * Why the draft can't be saved, or null when it's fine.
 * @param draft The draft.
 * @returns A message, or null.
 */
export const ProductDraftProblem = (draft: ProductDraft): string | null => {
    if (!draft.name.trim()) return "Give the product a name.";
    if (draft.variants.some((v) => !(v.size ?? "").trim())) return "Every size row needs a size.";

    const saleProblem = SaleProblem(draft.sale);
    if (saleProblem) return saleProblem;
    const sizeSale = draft.variants.find((v) => SaleProblem(v.sale));
    if (sizeSale) return `${sizeSale.size}: ${SaleProblem(sizeSale.sale)}`;

    const optionsProblem = OptionsProblem(draft.options);
    if (optionsProblem) return optionsProblem;

    for (const d of draft.delivery) {
        const problem = SaleProblem(DraftDeliverySale(draft, d.deliveryOptionId));
        if (problem) return `${d.name}: ${problem}`;
    }
    return null;
};

/**
 * The draft as saved.
 * @param product The product being edited, for what the form doesn't change.
 * @param draft The draft.
 * @returns The product to send.
 */
export const DraftToProduct = (product: Product, draft: ProductDraft): Product => {
    const itemSale = FromSaleDraft(draft.sale);
    return {
        id: product.id,
        territoryId: product.territoryId,
        name: draft.name.trim(),
        brand: draft.brand.trim(),
        category: draft.category,
        notes: draft.notes.trim(),
        isActive: draft.isActive,
        trackInventory: draft.trackInventory,
        hasWarranty: DraftHasWarranty(draft),
        warrantyLength: draft.warrantyLength.trim(),
        sortOrder: product.sortOrder ?? 0,
        saleDiscountPercent: itemSale.percent,
        saleDiscountAmount: itemSale.amount,
        options: FromDraftOptions(draft.options),
        variants: draft.variants.map((v, index) => ({
            id: v.id,
            size: (v.size ?? "").trim(),
            configuration: (v.configuration ?? "").trim() || null,
            // A blank price is stored as null, which the floor shows as "Inquire" and forces
            // the rep to key a price in rather than sell at a guess.
            price: v.priceText.trim() === "" ? null : ParseMoney(v.priceText),
            components: (v.components ?? []).map((c) => ({
                componentVariantId: c.componentVariantId,
                quantity: c.quantity ?? 1,
            })),
            isActive: v.isActive ?? true,
            excludeFromInventory: v.excludeFromInventory ?? false,
            notes: (v.notes ?? "").trim() || null,
            sortOrder: index + 1,
            hasOwnSale: v.sale.mode !== "follow",
            saleDiscountPercent: FromSaleDraft(v.sale).percent,
            saleDiscountAmount: FromSaleDraft(v.sale).amount,
        })),
        deliveryOptions: draft.delivery.map((d) => {
            const sale = DraftDeliverySale(draft, d.deliveryOptionId);
            const off = FromSaleDraft(sale);
            return {
                ...d,
                hasOwnSale: sale.mode !== "follow",
                saleDiscountPercent: off.percent,
                saleDiscountAmount: off.amount,
            };
        }),
    };
};
