import { useEffect, useState } from "react";
import { useAuth } from "../Context/AuthContext";
import { useSettings } from "../Context/SettingsContext";
import { InventoryRowKey, InventorySizeLabel, StockLevelOf, StockToWatch } from "../Lib/Inventory";
import type { InventoryItem } from "../Models/InventoryItem";
import { GetInventory } from "../Services/InventoryServices";

/** How many sizes to list before summarising the rest. */
const SHOW = 6;

/** How often the card refreshes on its own. */
const REFRESH_MS = 60000;

/** One size on the card. */
export type StockWatchRow = {
    key: string;
    productName: string;
    sizeLabel: string;
    onHand: number;
    /** True when none are left; otherwise it is running low. */
    out: boolean;
};

/**
 * The dashboard's Stock to watch card: the sizes running out, out-of-stock first, read again every
 * minute. A failed read keeps what is on the card.
 * @param refreshKey Changes to read the stock again at once (a pull to refresh).
 * @returns Null when nothing is tracked, so there is nothing to watch; otherwise the running-low
 * level, the first few sizes, how many more there are, a summary line, and whether the user may
 * open the Inventory screen to restock.
 */
export const useStockWatch = (refreshKey = 0) => {
    const { hasRole } = useAuth();
    const {
        settings: { lowStockAt },
    } = useSettings();
    const [items, setItems] = useState<InventoryItem[] | null>(null);

    useEffect(() => {
        const load = () =>
            GetInventory().then((rows) => {
                if (rows) setItems(rows);
            });
        load();
        const timer = setInterval(load, REFRESH_MS);
        return () => clearInterval(timer);
    }, [refreshKey]);

    if (!items || items.length === 0) return null;

    const { watch, outCount, lowCount } = StockToWatch(items, lowStockAt);
    const rows: StockWatchRow[] = watch.slice(0, SHOW).map((item) => ({
        key: InventoryRowKey(item),
        productName: item.productName ?? "",
        sizeLabel: InventorySizeLabel(item),
        onHand: item.quantityOnHand ?? 0,
        out: StockLevelOf(item.quantityOnHand, lowStockAt) === "out",
    }));
    const summary = [
        outCount > 0 ? `${outCount} size${outCount === 1 ? "" : "s"} out` : "",
        lowCount > 0 ? `${lowCount} running low` : "",
    ]
        .filter(Boolean)
        .join(" · ");
    const more = watch.length - rows.length;

    return {
        lowStockAt,
        rows,
        summary,
        moreText: more > 0 ? `and ${more} more size${more === 1 ? "" : "s"}` : null,
        canRestock: hasRole("Checkout"),
    };
};
