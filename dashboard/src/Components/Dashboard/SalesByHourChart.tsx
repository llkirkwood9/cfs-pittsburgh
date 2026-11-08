import { useMemo, useState } from "react";
import { SalesChart } from "@shared/Lib/Dashboard";
import { FormatCurrency } from "@shared/Lib/Format";
import type { SaleMoment } from "@shared/Models/DashboardStats";

type Props = {
    sales: SaleMoment[];
};

/** Chart height in pixels, not counting the labels underneath. */
const PLOT_PX = 150;

/**
 * Sales pace: what came in each hour (or each day, for an event that ran over several). One
 * series in one color, so the title names it rather than a legend; hovering or tapping a bar
 * gives its exact figures, and a hidden table carries the same numbers for screen readers.
 */
const SalesByHourChart = ({ sales }: Props) => {
    const { bars, byDay, max, busiest } = useMemo(() => SalesChart(sales, PLOT_PX), [sales]);
    const [focused, setFocused] = useState<number | null>(null);

    return (
        <section className="rounded-xl bg-white p-4 shadow-xs dark:bg-zinc-800">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Sales by {byDay ? "day" : "hour"}
                </h2>
                {busiest && (
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        Busiest:{" "}
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {busiest.long}
                        </span>{" "}
                        &middot; {FormatCurrency(busiest.total)} from {busiest.count} sale
                        {busiest.count === 1 ? "" : "s"}
                    </p>
                )}
            </div>

            {bars.length === 0 ? (
                <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    No completed sales yet.
                </p>
            ) : (
                <>
                    <div className="relative" onMouseLeave={() => setFocused(null)}>
                        {/* Recessive top value so the scale can be read without gridlines. */}
                        <p className="mb-1 text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                            {FormatCurrency(max)}
                        </p>
                        <div
                            className="flex items-end gap-[2px] border-b border-zinc-200 dark:border-zinc-700"
                            style={{ height: PLOT_PX }}
                            aria-hidden="true"
                        >
                            {bars.map((b, i) => {
                                return (
                                    <button
                                        key={b.key}
                                        type="button"
                                        tabIndex={-1}
                                        onMouseEnter={() => setFocused(i)}
                                        onClick={() => setFocused(focused === i ? null : i)}
                                        className="relative flex h-full min-w-0 flex-1 items-end justify-center"
                                    >
                                        {/* The whole column is the hit target; the bar is the mark. */}
                                        <span
                                            className={`w-full max-w-[40px] rounded-t-[4px] transition-colors ${
                                                focused === i
                                                    ? "bg-sky-700 dark:bg-sky-500"
                                                    : "bg-sky-600"
                                            }`}
                                            style={{ height: b.height }}
                                        />
                                    </button>
                                );
                            })}
                        </div>
                        <div className="mt-1 flex gap-[2px]" aria-hidden="true">
                            {bars.map((b) => (
                                <span
                                    key={b.key}
                                    className="min-w-0 flex-1 truncate text-center text-[11px] text-zinc-500 dark:text-zinc-400"
                                >
                                    {b.showLabel ? b.label : ""}
                                </span>
                            ))}
                        </div>

                        {focused !== null && bars[focused] && (
                            <div
                                className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-zinc-900 px-2.5 py-1.5
                                    text-xs text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
                                style={{
                                    left: `${((focused + 0.5) / bars.length) * 100}%`,
                                }}
                            >
                                <p className="font-semibold">{bars[focused].long}</p>
                                <p className="tabular-nums">
                                    {FormatCurrency(bars[focused].total)} &middot;{" "}
                                    {bars[focused].count} sale
                                    {bars[focused].count === 1 ? "" : "s"}
                                </p>
                            </div>
                        )}
                    </div>

                    <table className="sr-only">
                        <caption>Sales by {byDay ? "day" : "hour"}</caption>
                        <thead>
                            <tr>
                                <th>{byDay ? "Day" : "Hour"}</th>
                                <th>Sales</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bars.map((b) => (
                                <tr key={b.key}>
                                    <td>{b.long}</td>
                                    <td>{b.count}</td>
                                    <td>{FormatCurrency(b.total)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}
        </section>
    );
};

export default SalesByHourChart;
