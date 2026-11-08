import { useNavigate } from "react-router-dom";
import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import { useStockWatch } from "@shared/Hooks/useStockWatch";
import { ScreenLinks } from "../../Lib/ScreenLinks";

/**
 * The accessories running out, so the floor knows what can still go home today and checkout knows
 * what to restock. Out-of-stock sizes first, then the ones down to their last couple.
 */
const StockWatch = () => {
    const navigate = useNavigate();
    const stock = useStockWatch();

    // Nothing is tracked, so there is nothing to watch.
    if (!stock) return null;

    return (
        <section className="rounded-xl bg-white p-4 shadow-xs dark:bg-zinc-800">
            <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Stock to watch
                </h2>
                {stock.canRestock && (
                    <Button
                        text="Inventory"
                        icon="fa-solid fa-boxes-stacked"
                        onClick={() => navigate(ScreenLinks.inventory.path)}
                        className="min-h-[36px] bg-zinc-500 px-3 text-xs hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                    />
                )}
            </div>

            {stock.rows.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                    <Icon icon="fa-solid fa-circle-check" />
                    Every counted size has more than {stock.lowStockAt} on hand.
                </p>
            ) : (
                <>
                    <p className="mb-1 text-xs text-zinc-600 dark:text-zinc-400">{stock.summary}</p>
                    <ul className="divide-y divide-zinc-100 dark:divide-zinc-700">
                        {stock.rows.map((row) => (
                            <li key={row.key} className="flex items-center gap-2 py-2">
                                <span className="min-w-0 flex-1 text-sm">
                                    <span className="font-medium">{row.productName}</span>{" "}
                                    <span className="text-zinc-500 dark:text-zinc-400">
                                        {row.sizeLabel}
                                    </span>
                                </span>
                                {/* Status carries an icon and a word, never color alone. */}
                                <span
                                    className={`inline-flex shrink-0 items-center gap-1 text-xs font-semibold ${
                                        row.out
                                            ? "text-red-700 dark:text-red-400"
                                            : "text-amber-700 dark:text-amber-400"
                                    }`}
                                >
                                    <Icon
                                        icon={
                                            row.out
                                                ? "fa-solid fa-circle-xmark"
                                                : "fa-solid fa-triangle-exclamation"
                                        }
                                    />
                                    {row.out ? "Out" : `${row.onHand} left`}
                                </span>
                            </li>
                        ))}
                    </ul>
                    {stock.moreText && (
                        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                            {stock.moreText}
                        </p>
                    )}
                </>
            )}
        </section>
    );
};

export default StockWatch;
