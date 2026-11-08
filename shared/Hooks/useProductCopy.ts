import { useEffect, useMemo, useState } from "react";
import { Toast } from "@host";
import type { Product } from "../Models/Product";
import { CopyProduct, GetProducts } from "../Services/ProductServices";

/**
 * Copying an item from another territory's catalog: the territory picked, its items (by
 * category, then name), the item picked, and the copy.
 * @param onCopied Takes the copy, made in the territory in view.
 * @returns The state and handlers.
 */
export const useProductCopy = (onCopied: (product: Product) => void) => {
    const [territoryId, setTerritoryId] = useState<number | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [productId, setProductId] = useState<number | null>(null);
    const [copying, setCopying] = useState<boolean>(false);

    useEffect(() => {
        if (territoryId == null) return;
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            const found = await GetProducts(true, territoryId);
            if (cancelled) return;
            setProducts(found);
            setLoading(false);
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [territoryId]);

    const sorted = useMemo(
        () =>
            [...products].sort(
                (a, b) =>
                    (a.category ?? "").localeCompare(b.category ?? "") ||
                    (a.name ?? "").localeCompare(b.name ?? "")
            ),
        [products]
    );

    /** Picks the territory to copy from, clearing the item picked. */
    const pickTerritory = (id: number | null) => {
        setTerritoryId(id);
        setProductId(null);
        setProducts([]);
    };

    const copy = async () => {
        if (productId == null) return Toast.Warning("Pick the item to copy.");
        setCopying(true);
        const result = await CopyProduct(productId);
        setCopying(false);
        if (!result?.product) return;

        Toast.Success(`${result.product.name} copied into this catalog.`);
        for (const note of result.notes ?? []) Toast.Info(note);
        onCopied(result.product);
    };

    return {
        territoryId,
        pickTerritory,
        /** The territory's items, by category then name. */
        products: sorted,
        loading,
        /** The item list's prompt. */
        itemPrompt: loading
            ? "Loading..."
            : territoryId == null
              ? "Pick a territory first"
              : "Pick an item...",
        productId,
        setProductId,
        copying,
        copy,
    };
};
