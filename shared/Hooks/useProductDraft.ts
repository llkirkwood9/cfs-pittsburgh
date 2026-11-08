import { useState } from "react";
import { Toast } from "@host";
import { SaleDraftOffText } from "../Lib/CatalogDrafts";
import type { SaleDraft } from "../Lib/CatalogDrafts";
import { ParseMoney } from "../Lib/Format";
import {
    ApplyBundlePick,
    DraftDeliverySale,
    DraftHasWarranty,
    DraftToProduct,
    NewDraftVariant,
    ProductDraftProblem,
    ToggleDraftDelivery,
    ToProductDraft,
} from "../Lib/ProductDraft";
import type { BundlePick, DraftVariant, ProductDraft } from "../Lib/ProductDraft";
import type { Category } from "../Models/Category";
import type { DeliveryOption } from "../Models/DeliveryOption";
import type { Product } from "../Models/Product";

/**
 * The product form's state: the draft, the edits made to it, and saving it.
 * @param product The product being edited, or a blank one for a new item.
 * @param categories Its territory's categories, to pick from.
 * @param onSave Saves the product; the form closes once it's done.
 * @param onClose Closes the form.
 * @returns The draft and its handlers.
 */
export const useProductDraft = (
    product: Product,
    categories: Category[],
    onSave: (product: Product) => Promise<void>,
    onClose: () => void
) => {
    const [draft, setDraft] = useState<ProductDraft>(() => ToProductDraft(product));
    const [saving, setSaving] = useState<boolean>(false);
    const [bundlingIndex, setBundlingIndex] = useState<number | null>(null);

    /** Changes any of the draft's fields. */
    const change = (changes: Partial<ProductDraft>) => setDraft((d) => ({ ...d, ...changes }));

    const setVariant = (index: number, changes: Partial<DraftVariant>) =>
        setDraft((d) => ({
            ...d,
            variants: d.variants.map((row, i) => (i === index ? { ...row, ...changes } : row)),
        }));

    const addVariant = () =>
        setDraft((d) => ({
            ...d,
            variants: [...d.variants, NewDraftVariant(d.variants.length + 1)],
        }));

    const removeVariant = (index: number) =>
        setDraft((d) => ({ ...d, variants: d.variants.filter((_, i) => i !== index) }));

    const applyBundlePick = (index: number, pick: BundlePick) => {
        const { variants, skipped } = ApplyBundlePick(draft.variants, index, pick);
        change({ variants });
        if (skipped > 0)
            Toast.Info(`${pick.product.name} has no matching size for ${skipped} of these sizes.`);
    };

    const removeComponent = (index: number, componentVariantId?: number) =>
        setVariant(index, {
            components: (draft.variants[index].components ?? []).filter(
                (c) => c.componentVariantId !== componentVariantId
            ),
        });

    const toggleDelivery = (option: DeliveryOption) =>
        setDraft((d) => ({ ...d, ...ToggleDraftDelivery(d, option) }));

    const setDeliveryOverride = (deliveryOptionId: number, value: string) =>
        setDraft((d) => ({
            ...d,
            overrideText: { ...d.overrideText, [deliveryOptionId]: value },
            delivery: d.delivery.map((row) =>
                row.deliveryOptionId === deliveryOptionId
                    ? { ...row, priceOverride: value.trim() === "" ? null : ParseMoney(value) }
                    : row
            ),
        }));

    const setDefaultDelivery = (deliveryOptionId: number) =>
        setDraft((d) => ({
            ...d,
            delivery: d.delivery.map((row) => ({
                ...row,
                isDefault: row.deliveryOptionId === deliveryOptionId,
            })),
        }));

    const setDeliverySale = (deliveryOptionId: number | undefined, sale: SaleDraft) =>
        setDraft((d) => ({
            ...d,
            deliverySales: { ...d.deliverySales, [deliveryOptionId ?? 0]: sale },
        }));

    const save = async () => {
        const problem = ProductDraftProblem(draft);
        if (problem) return Toast.Warning(problem);

        setSaving(true);
        await onSave(DraftToProduct(product, draft));
        setSaving(false);
        onClose();
    };

    return {
        draft,
        change,
        hasWarranty: DraftHasWarranty(draft),
        /** The category names to pick from. */
        categoryNames: categories.map((c) => c.name ?? ""),
        /** What a size following the item's sale gets, for its label. */
        itemSaleLabel: SaleDraftOffText(draft.sale),
        /** A delivery choice's price override as typed. */
        overrideText: (deliveryOptionId: number) => draft.overrideText[deliveryOptionId] ?? "",
        deliverySale: (deliveryOptionId?: number) => DraftDeliverySale(draft, deliveryOptionId),
        setDeliverySale,
        setVariant,
        addVariant,
        removeVariant,
        applyBundlePick,
        removeComponent,
        toggleDelivery,
        setDeliveryOverride,
        setDefaultDelivery,
        /** The size whose bundle an item is being picked for, if any. */
        bundlingIndex,
        setBundlingIndex,
        saving,
        save,
    };
};
