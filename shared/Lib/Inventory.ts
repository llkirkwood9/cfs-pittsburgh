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

/** What each kind of stock change is called in a size's history. */
export const InventoryKindLabels: Record<string, string> = {
    Adjustment: "Count changed",
    Sale: "Take With sale",
    Return: "Returned to stock",
    Count: "End-of-event count",
    OpeningCount: "Start-of-event count",
};

/** How a size's stock stands: none left, running low, or fine. */
export type StockLevel = "out" | "low" | "ok";

/**
 * How a size's stock stands. Counts at or below the running-low level set under Settings are low.
 * @param onHand Units on hand.
 * @param lowStockAt The running-low level.
 * @returns The level.
 */
export const StockLevelOf = (onHand: number | null | undefined, lowStockAt: number): StockLevel =>
    (onHand ?? 0) <= 0 ? "out" : (onHand ?? 0) <= lowStockAt ? "low" : "ok";

/**
 * The sizes running out, out-of-stock first, then the ones down to their last few.
 * @param items Inventory rows.
 * @param lowStockAt The running-low level.
 * @returns The sizes to watch, and how many are out and how many low.
 */
export const StockToWatch = (
    items: InventoryItem[],
    lowStockAt: number
): { watch: InventoryItem[]; outCount: number; lowCount: number } => {
    const watch = items
        .filter((i) => StockLevelOf(i.quantityOnHand, lowStockAt) !== "ok")
        .sort((a, b) => (a.quantityOnHand ?? 0) - (b.quantityOnHand ?? 0));
    const outCount = watch.filter(
        (i) => StockLevelOf(i.quantityOnHand, lowStockAt) === "out"
    ).length;
    return { watch, outCount, lowCount: watch.length - outCount };
};

/**
 * The categories that have tracked items, in the order they first appear.
 * @param items Inventory rows.
 * @returns The categories.
 */
export const InventoryCategories = (items: InventoryItem[]): ProductCategory[] =>
    Array.from(new Set(items.map((i) => i.category ?? "Misc"))) as ProductCategory[];

/**
 * The inventory rows in a category tab that match a search on product, brand or size.
 * @param items Inventory rows.
 * @param tab The category, or "All".
 * @param search What was typed.
 * @returns The matching rows.
 */
export const FilterInventory = (
    items: InventoryItem[],
    tab: ProductCategory | "All",
    search: string
): InventoryItem[] => {
    const term = search.trim().toLowerCase();
    return items.filter((i) => {
        if (tab !== "All" && i.category !== tab) return false;
        if (!term) return true;
        return (
            (i.productName ?? "").toLowerCase().includes(term) ||
            (i.brand ?? "").toLowerCase().includes(term) ||
            (i.size ?? "").toLowerCase().includes(term)
        );
    });
};

/** One of the event's shelf counts, as the Inventory screen shows it. */
export type ShelfCountStatus = {
    phase: "start" | "end";
    title: string;
    /** What to do when it hasn't been taken. */
    hint: string;
    /** Whether it is due now, and so stands out. */
    due: boolean;
    /** When it was last taken, or null. */
    at: string | null | undefined;
    /** Who took it. */
    by: string | null | undefined;
};

/**
 * When each of the event's shelf counts was last taken, and by whom.
 * @param items Inventory rows for the event.
 * @returns The start and end counts.
 */
export const ShelfCounts = (items: InventoryItem[]): ShelfCountStatus[] => {
    const latest = (
        at: (i: InventoryItem) => string | null | undefined,
        by: (i: InventoryItem) => string | null | undefined
    ) => {
        const row = items
            .filter((i) => at(i))
            .sort((a, b) => (at(b) ?? "").localeCompare(at(a) ?? ""))[0];
        return { at: row ? at(row) : null, by: row ? by(row) : null };
    };
    const opening = latest(
        (i) => i.openingCountedAt,
        (i) => i.openingCountedBy
    );
    const closing = latest(
        (i) => i.countedAt,
        (i) => i.countedBy
    );
    return [
        {
            phase: "start",
            title: "Start-of-event count",
            hint: "Not done yet - count the shelf before the doors open",
            due: !opening.at,
            ...opening,
        },
        {
            phase: "end",
            title: "End-of-event count",
            hint: "Count what is left once the event is over",
            due: false,
            ...closing,
        },
    ];
};

/**
 * The stock totals at the top of the Inventory screen.
 * @param items Inventory rows.
 * @returns Units on hand, and how many sizes are out of stock.
 */
export const InventoryTotals = (
    items: InventoryItem[]
): { totalUnits: number; outOfStock: number } => ({
    totalUnits: items.reduce((sum, i) => sum + Math.max(0, i.quantityOnHand ?? 0), 0),
    outOfStock: items.filter((i) => (i.quantityOnHand ?? 0) <= 0).length,
});
