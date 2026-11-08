import { useMemo, useState } from "react";
import { Toast } from "@host";
import { BundleCategories } from "../Lib/Catalog";
import type { BundlePick } from "../Lib/ProductDraft";
import type { Product } from "../Models/Product";

/**
 * The bundle picker's state: the items that can be included, the tab and search, and the item,
 * size, quantity and matching being picked.
 * @param catalog The territory's catalog.
 * @param excludeProductId The product being edited, which can't include itself.
 * @param size The bundle's size, which the picked item starts on.
 * @param onPick Takes the pick.
 * @param onClose Closes the picker.
 * @returns The state and handlers.
 */
export const useProductBundlePicker = (
    catalog: Product[],
    excludeProductId: number | undefined,
    size: string | undefined,
    onPick: (pick: BundlePick) => void,
    onClose: () => void
) => {
    // Bundles cannot contain bundles, so only items sold on their own are offered.
    const choices = useMemo(
        () =>
            catalog
                .filter((p) => p.id !== excludeProductId)
                .map((p) => ({
                    ...p,
                    variants: (p.variants ?? []).filter((v) => (v.components ?? []).length === 0),
                }))
                .filter((p) => p.variants.length > 0),
        [catalog, excludeProductId]
    );

    const categories = useMemo(() => BundleCategories(choices), [choices]);

    const [tab, setTab] = useState<string>(categories[0] ?? "");
    const [search, setSearch] = useState<string>("");
    const [product, setProduct] = useState<Product | null>(null);
    const [variantId, setVariantId] = useState<number | null>(null);
    const [quantity, setQuantity] = useState<number>(1);
    const [matchSizes, setMatchSizes] = useState<boolean>(true);

    const term = search.trim().toLowerCase();
    const filtered = choices.filter(
        (p) =>
            p.category === tab &&
            (!term ||
                (p.name ?? "").toLowerCase().includes(term) ||
                (p.brand ?? "").toLowerCase().includes(term))
    );

    const choose = (picked: Product) => {
        setProduct(picked);
        // Start on the same size as the bundle, which is nearly always the right one.
        const sameSize = picked.variants?.find(
            (v) => (v.size ?? "").toLowerCase() === (size ?? "").toLowerCase()
        );
        setVariantId(sameSize?.id ?? picked.variants?.[0]?.id ?? null);
    };

    const add = () => {
        const variant = product?.variants?.find((v) => v.id === variantId);
        if (!product || !variant) return Toast.Warning("Pick a size.");
        onPick({ product, variant, quantity, matchSizes });
        onClose();
    };

    return {
        categories,
        tab,
        setTab,
        search,
        setSearch,
        filtered,
        product,
        /** Back to the list of items. */
        unchoose: () => setProduct(null),
        choose,
        variantId,
        setVariantId,
        quantity,
        setQuantity,
        matchSizes,
        setMatchSizes,
        add,
    };
};
