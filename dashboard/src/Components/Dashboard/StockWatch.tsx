import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import { useAuth } from "../../Context/AuthContext";
import { useSettings } from "../../Context/SettingsContext";
import { IsOnline } from "../../Lib/Connection";
import { InventoryRowKey, InventorySizeLabel } from "../../Lib/ModelHelpers";
import type { InventoryItem } from "../../Models/InventoryItem";
import { GetInventory } from "../../Services/InventoryServices";

/** How many sizes to list before summarising the rest. */
const SHOW = 6;

/** How often the card refreshes on its own. */
const REFRESH_MS = 60000;

/**
 * The accessories running out, so the floor knows what can still go home today and checkout knows
 * what to restock. Out-of-stock sizes first, then the ones down to their last couple.
 */
const StockWatch = () => {
    const navigate = useNavigate();
    const { hasRole } = useAuth();
    const {
        settings: { lowStockAt: LOW },
    } = useSettings();
    const [items, setItems] = useState<InventoryItem[] | null>(null);

    useEffect(() => {
        const load = () =>
            GetInventory().then((rows) => {
                if (IsOnline()) setItems(rows);
            });
        load();
        const timer = setInterval(load, REFRESH_MS);
        return () => clearInterval(timer);
    }, []);

    // Nothing is tracked, so there is nothing to watch.
    if (!items || items.length === 0) return null;

    const watch = items
        .filter((i) => (i.quantityOnHand ?? 0) <= LOW)
        .sort((a, b) => (a.quantityOnHand ?? 0) - (b.quantityOnHand ?? 0));
    const outCount = watch.filter((i) => (i.quantityOnHand ?? 0) <= 0).length;
    const lowCount = watch.length - outCount;

    return (
        <section className="rounded-xl bg-white p-4 shadow-xs dark:bg-zinc-800">
            <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Stock to watch
                </h2>
                {hasRole("Checkout") && (
                    <Button
                        text="Inventory"
                        icon="fa-solid fa-boxes-stacked"
                        onClick={() => navigate("/inventory")}
                        className="min-h-[36px] bg-zinc-500 px-3 text-xs hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                    />
                )}
            </div>

            {watch.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                    <Icon icon="fa-solid fa-circle-check" />
                    Every counted size has more than {LOW} on hand.
                </p>
            ) : (
                <>
                    <p className="mb-1 text-xs text-zinc-600 dark:text-zinc-400">
                        {outCount > 0 && `${outCount} size${outCount === 1 ? "" : "s"} out`}
                        {outCount > 0 && lowCount > 0 && " · "}
                        {lowCount > 0 && `${lowCount} running low`}
                    </p>
                    <ul className="divide-y divide-zinc-100 dark:divide-zinc-700">
                        {watch.slice(0, SHOW).map((item) => {
                            const onHand = item.quantityOnHand ?? 0;
                            const out = onHand <= 0;
                            return (
                                <li key={InventoryRowKey(item)} className="flex items-center gap-2 py-2">
                                    <span className="min-w-0 flex-1 text-sm">
                                        <span className="font-medium">{item.productName}</span>{" "}
                                        <span className="text-zinc-500 dark:text-zinc-400">
                                            {InventorySizeLabel(item)}
                                        </span>
                                    </span>
                                    {/* Status carries an icon and a word, never color alone. */}
                                    <span
                                        className={`inline-flex shrink-0 items-center gap-1 text-xs font-semibold ${
                                            out
                                                ? "text-red-700 dark:text-red-400"
                                                : "text-amber-700 dark:text-amber-400"
                                        }`}
                                    >
                                        <Icon
                                            icon={
                                                out
                                                    ? "fa-solid fa-circle-xmark"
                                                    : "fa-solid fa-triangle-exclamation"
                                            }
                                        />
                                        {out ? "Out" : `${onHand} left`}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                    {watch.length > SHOW && (
                        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                            and {watch.length - SHOW} more size{watch.length - SHOW === 1 ? "" : "s"}
                        </p>
                    )}
                </>
            )}
        </section>
    );
};

export default StockWatch;
