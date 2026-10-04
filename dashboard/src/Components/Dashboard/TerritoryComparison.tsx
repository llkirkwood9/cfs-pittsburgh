import { useCallback, useEffect, useState } from "react";
import Icon from "../Elements/Icon";
import TabButton from "../Elements/TabButton";
import { useTerritory } from "../../Context/TerritoryContext";
import { IsOnline } from "../../Lib/Connection";
import { FormatCurrency } from "../../Lib/ModelHelpers";
import type { TerritoryStats } from "../../Models/Territory";
import { GetTerritoryComparison } from "../../Services/DashboardServices";

type Range = "today" | "week" | "month" | "year" | "all";

const ranges: { key: Range; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "7 days" },
    { key: "month", label: "30 days" },
    { key: "year", label: "This year" },
    { key: "all", label: "All time" },
];

/** A date as YYYY-MM-DD in the viewer's own time zone. */
const isoDay = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const rangeDates = (range: Range): { from?: string; to?: string } => {
    const today = new Date();
    const back = (days: number) => {
        const d = new Date(today);
        d.setDate(d.getDate() - days);
        return isoDay(d);
    };
    switch (range) {
        case "today":
            return { from: isoDay(today), to: isoDay(today) };
        case "week":
            return { from: back(6), to: isoDay(today) };
        case "month":
            return { from: back(29), to: isoDay(today) };
        case "year":
            return { from: `${today.getFullYear()}-01-01`, to: isoDay(today) };
        default:
            return {};
    }
};

type Props = {
    /** Refresh interval in milliseconds, matching the rest of the dashboard. */
    pollMs: number;
};

/**
 * Every territory side by side, for an owner or administrator viewing all of them: completed
 * sales and the headline figures over the chosen dates. Tapping a territory switches the whole
 * dashboard to it.
 */
const TerritoryComparison = ({ pollMs }: Props) => {
    const { setTerritoryId } = useTerritory();
    const [range, setRange] = useState<Range>("today");
    const [rows, setRows] = useState<TerritoryStats[] | null>(null);

    const load = useCallback(async (which: Range) => {
        const { from, to } = rangeDates(which);
        const result = await GetTerritoryComparison(from, to);
        // Keep the last figures up while the server can't be reached.
        if (result || IsOnline()) setRows(result ?? []);
    }, []);

    useEffect(() => {
        load(range);
        const timer = setInterval(() => load(range), pollMs);
        return () => clearInterval(timer);
    }, [range, load, pollMs]);

    const top = Math.max(1, ...(rows ?? []).map((r) => r.totalSales ?? 0));
    const totals = (rows ?? []).reduce(
        (sum, r) => ({
            orders: sum.orders + (r.completedOrderCount ?? 0),
            total: sum.total + (r.totalSales ?? 0),
            net: sum.net + (r.netSales ?? 0),
            mattresses: sum.mattresses + (r.mattressCount ?? 0),
            bases: sum.bases + (r.adjustableBaseCount ?? 0),
        }),
        { orders: 0, total: 0, net: 0, mattresses: 0, bases: 0 }
    );

    return (
        <section className="mb-4 rounded-xl bg-white p-4 shadow-sm dark:bg-zinc-800">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Territories side by side
                </h2>
                <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
                    {ranges.map((r) => (
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
                    <table className="w-full min-w-[40rem] text-sm">
                        <thead>
                            <tr className="border-b border-zinc-200 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                                <th className="py-2 pr-3">Territory</th>
                                <th className="py-2 pr-3">Total sales</th>
                                <th className="py-2 pr-3 text-right">Sales</th>
                                <th className="py-2 pr-3 text-right">Net</th>
                                <th className="py-2 pr-3 text-right">Average</th>
                                <th className="py-2 pr-3 text-right">Matts / bases</th>
                                <th className="py-2 text-right">Owed</th>
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
                                    <td className="py-2 pr-3 text-right tabular-nums">
                                        {row.mattressCount ?? 0} / {row.adjustableBaseCount ?? 0}
                                    </td>
                                    <td
                                        className={`py-2 text-right tabular-nums ${
                                            (row.outstandingBalance ?? 0) > 0
                                                ? "font-semibold text-amber-700 dark:text-amber-400"
                                                : ""
                                        }`}
                                    >
                                        {FormatCurrency(row.outstandingBalance)}
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
                                    <td className="py-2 pr-3 text-right tabular-nums">
                                        {totals.mattresses} / {totals.bases}
                                    </td>
                                    <td className="py-2" />
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
