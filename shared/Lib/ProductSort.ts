import type { Product } from "../Models/Product";

/** How a list of products can be ordered. */
export type ProductSortKey = "name-asc" | "name-desc" | "price-asc" | "price-desc" | "brand";

/** The sort buttons, in the order they are shown. */
export const ProductSortOptions: { key: ProductSortKey; label: string }[] = [
    { key: "name-asc", label: "Name A-Z" },
    { key: "name-desc", label: "Name Z-A" },
    { key: "price-asc", label: "Price low-high" },
    { key: "price-desc", label: "Price high-low" },
    { key: "brand", label: "Brand" },
];

/** Natural, case-insensitive ordering, so "Agility 3000" sorts before "Agility 5000". */
export const ByText = (a?: string | null, b?: string | null) =>
    (a ?? "").localeCompare(b ?? "", undefined, { numeric: true, sensitivity: "base" });

/**
 * The cheapest priced size of a product, used for price sorting and the "from" label. Null when
 * every size is Inquire.
 * @param product The product.
 * @returns The lowest price, or null.
 */
export const LowestPrice = (product: Product): number | null => {
    const prices = (product.variants ?? [])
        .map((v) => v.price)
        .filter((price): price is number => price !== null && price !== undefined);
    return prices.length ? Math.min(...prices) : null;
};

/**
 * Orders products for a list. Categories stay grouped - in the order given, so an All list
 * follows the tabs - and the chosen sort applies within each one. Products with no price
 * (Inquire on every size) go last when sorting by price, either way.
 * @param products The products.
 * @param key How to sort.
 * @param categoryOrder Category names in the order they are shown; others go last.
 * @returns A sorted copy.
 */
export const SortProducts = (
    products: Product[],
    key: ProductSortKey,
    categoryOrder: readonly string[]
): Product[] => {
    const rank = (p: Product) => {
        const index = categoryOrder.indexOf(p.category ?? "Misc");
        return index < 0 ? categoryOrder.length : index;
    };

    const compare = (a: Product, b: Product): number => {
        switch (key) {
            case "name-desc":
                return ByText(b.name, a.name);
            case "price-asc":
            case "price-desc": {
                const pa = LowestPrice(a);
                const pb = LowestPrice(b);
                if (pa === null || pb === null)
                    return pa === pb ? ByText(a.name, b.name) : pa === null ? 1 : -1;
                const diff = key === "price-asc" ? pa - pb : pb - pa;
                return diff !== 0 ? diff : ByText(a.name, b.name);
            }
            case "brand":
                return ByText(a.brand, b.brand) || ByText(a.name, b.name);
            default:
                return ByText(a.name, b.name);
        }
    };

    return [...products].sort((a, b) => rank(a) - rank(b) || compare(a, b));
};
