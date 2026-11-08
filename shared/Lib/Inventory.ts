import type { InventoryItem } from "../Models/InventoryItem";
import type { ProductCategory } from "../Models/Product";

export type InventoryGroup = {
    category: ProductCategory;
    products: {
        productId: number;
        name: string;
        brand: string;
        sizes: InventoryItem[];
    }[];
};

/**
 * Groups inventory rows by category, then product, keeping the server's catalog order.
 * @param items Inventory rows.
 * @returns One group per category that has tracked items.
 */
export const GroupInventory = (items: InventoryItem[]): InventoryGroup[] => {
    const groups: InventoryGroup[] = [];

    for (const item of items) {
        const category = item.category ?? "Misc";
        let group = groups.find((g) => g.category === category);
        if (!group) {
            group = { category, products: [] };
            groups.push(group);
        }

        let product = group.products.find((p) => p.productId === item.productId);
        if (!product) {
            product = {
                productId: item.productId ?? 0,
                name: item.productName ?? "",
                brand: item.brand ?? "",
                sizes: [],
            };
            group.products.push(product);
        }

        product.sizes.push(item);
    }

    return groups;
};

/**
 * The size label for an inventory row, e.g. "Queen", "Queen - Soft" or, for stock counted by a
 * selection such as Color, "Queen - Gray".
 * @param item The inventory row.
 * @returns The label.
 */
export const InventorySizeLabel = (item: InventoryItem): string =>
    [item.size, item.configuration, item.choices].filter(Boolean).join(" - ") || "One size";

/**
 * A key for an inventory row: its size, plus the combination of counted choices (such as a
 * color) when stock is counted that way.
 * @param item The inventory row.
 * @returns The key.
 */
export const InventoryRowKey = (item: InventoryItem): string =>
    `${item.productVariantId ?? 0}|${item.stockKey ?? ""}`;

/**
 * Why a tracked item cannot go home as a Take With, or null when it can. A size left out of
 * inventory isn't kept at the cart, so it never can; other untracked items (a null count) always
 * can.
 * @param onHand Units on hand, or null/undefined when the product is not tracked.
 * @param quantity Units the customer wants to take.
 * @param notKept True when the size (or an item its bundle includes) is left out of inventory.
 * @returns A short reason such as "Out of stock" or "Only 2 in stock", or null.
 */
export const TakeWithBlocked = (
    onHand: number | null | undefined,
    quantity: number,
    notKept = false
): string | null => {
    if (notKept) return "Not kept at the cart";
    if (onHand === null || onHand === undefined) return null;
    if (onHand <= 0) return "Out of stock";
    return onHand < quantity ? `Only ${onHand} in stock` : null;
};
