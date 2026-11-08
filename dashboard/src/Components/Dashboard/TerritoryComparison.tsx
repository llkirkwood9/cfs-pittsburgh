import Icon from "../Elements/Icon";
import TabButton from "../Elements/TabButton";
import { useTerritory } from "@shared/Context/TerritoryContext";
import { useDashboardComparison } from "@shared/Hooks/useDashboardComparison";
import { ComparisonRanges } from "@shared/Lib/Dashboard";
import { FormatCurrency } from "@shared/Lib/Format";

/**
 * Every territory side by side, for a system admin or administrator viewing all of them: completed
 * sales and the headline figures over the chosen dates. Tapping a territory switches the whole
 * dashboard to it.
 */
const TerritoryComparison = () => {
    const { setTerritoryId } = useTerritory();
    const { range, setRange, rows, top, totals } = useDashboardComparison();

    return (
        <section className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-zinc-800">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Territories side by side
                </h2>
                <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
                    {ComparisonRanges.map((r) => (
                        <TabButton
                            key={r.key}
                            text={r.label}
                            active={range === r.key}
                            onClick={() => setRange(r.key)}
                            className="min-h-[36px] px-3 text-xs"
                        />
                    ))}
                </div>
            </div>

            {rows === null ? (
                <p className="py-4 text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>
            ) : rows.length === 0 ? (
                <p className="py-4 text-sm text-zinc-500 dark:text-zinc-400">
                    No territories yet. Add one on the Territories screen.
                </p>
            ) : (
                <div className="-mx-4 overflow-x-auto px-4">
                    <table className="w-full min-w-160 text-sm">
                        <thead>
                            <tr className="border-b border-zinc-200 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                                <th className="py-2 pr-3">Territory</th>
                                <th className="py-2 pr-3">Total sales</th>
                                <th className="py-2 pr-3 text-right">Sales</th>
                                <th className="py-2 pr-3 text-right">Net</th>
                                <th className="py-2 pr-3 text-right">Average</th>
                                <th className="py-2 text-right">Matts / bases</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr
                                    key={row.territoryId}
                                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-700/60"
                                >
                                    <td className="py-2 pr-3">
                                        <button
                                            type="button"
                                            onClick={() => setTerritoryId(row.territoryId ?? null)}
                                            className="min-h-[40px] text-left font-semibold text-sky-700 hover:underline dark:text-sky-400"
                                            title={`View ${row.territoryName}`}
                                        >
                                            {row.territoryName}
                                            {row.isActive === false && (
                                                <span className="ml-1.5 text-xs font-normal text-zinc-500">
                                                    (off)
                                                </span>
                                            )}
                                        </button>
                                        <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                                            {row.activeEvent ? (
                                                <>
                                                    <Icon
                                                        icon="fa-solid fa-circle-play"
                                                        className="mr-1 text-green-600 dark:text-green-400"
                                                    />
                                                    {row.activeEvent}
                                                </>
                                            ) : (
                                                "No active event"
                                            )}
                                        </span>
                                    </td>
                                    <td className="w-[30%] py-2 pr-3">
                                        <div className="flex items-center gap-2">
                                            <span className="w-24 shrink-0 font-semibold tabular-nums">
                                                {FormatCurrency(row.totalSales)}
                                            </span>
                                            <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700">
                                                <span
                                                    className="block h-full rounded-full bg-sky-600 dark:bg-sky-400"
                                                    style={{
                                                        width: `${((row.totalSales ?? 0) / top) * 100}%`,
                                                    }}
                                                />
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-2 pr-3 text-right tabular-nums">
                                        {row.completedOrderCount ?? 0}
                                    </td>
                                    <td className="py-2 pr-3 text-right tabular-nums">
                                        {FormatCurrency(row.netSales)}
                                    </td>
                                    <td className="py-2 pr-3 text-right tabular-nums">
                                        {FormatCurrency(row.averageSale)}
                                    </td>
                                    <td className="py-2 text-right tabular-nums">
                                        {row.mattressCount ?? 0} / {row.adjustableBaseCount ?? 0}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        {rows.length > 1 && (
                            <tfoot>
                                <tr className="border-t-2 border-zinc-200 font-bold dark:border-zinc-600">
                                    <td className="py-2 pr-3">All territories</td>
                                    <td className="py-2 pr-3 tabular-nums">
                                        {FormatCurrency(totals.total)}
                                    </td>
                                    <td className="py-2 pr-3 text-right tabular-nums">
                                        {totals.orders}
                                    </td>
                                    <td className="py-2 pr-3 text-right tabular-nums">
                                        {FormatCurrency(totals.net)}
                                    </td>
                                    <td className="py-2 pr-3 text-right tabular-nums">
                                        {FormatCurrency(
                                            totals.orders ? totals.total / totals.orders : 0
                                        )}
                                    </td>
                                    <td className="py-2 text-right tabular-nums">
                                        {totals.mattresses} / {totals.bases}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            )}
        </section>
    );
};

export default TerritoryComparison;
