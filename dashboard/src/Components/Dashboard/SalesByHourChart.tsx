import { useMemo, useState } from "react";
import { FormatCurrency, ParseServerTime } from "../../Lib/ModelHelpers";
import type { SaleMoment } from "../../Models/DashboardStats";

type Props = {
    sales: SaleMoment[];
};

type Bucket = { key: string; label: string; long: string; total: number; count: number };

/** Chart height in pixels, not counting the labels underneath. */
const PLOT_PX = 150;

const hourLabel = (hour: number) => {
    const h = hour % 12 === 0 ? 12 : hour % 12;
    return `${h}${hour < 12 ? "a" : "p"}`;
};

const hourLong = (hour: number) => {
    const h = hour % 12 === 0 ? 12 : hour % 12;
    return `${h} ${hour < 12 ? "AM" : "PM"}`;
};

const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Groups completed sales into bars: by hour of the day when they all fall on one day (the usual
 * event), otherwise by day. Every hour between the first and last sale gets a bar, so a quiet
 * hour shows as a gap rather than disappearing.
 * @param sales Completed sales.
 * @returns The bars, in order.
 */
const bucketSales = (sales: SaleMoment[]): { buckets: Bucket[]; byDay: boolean } => {
    const points = sales
        .map((s) => ({ at: ParseServerTime(s.at), total: s.total ?? 0 }))
        .filter((p): p is { at: Date; total: number } => p.at !== null);

    if (points.length === 0) return { buckets: [], byDay: false };

    const days = new Set(points.map((p) => dayKey(p.at)));
    if (days.size > 1) {
        const map = new Map<string, Bucket>();
        for (const p of points) {
            const key = dayKey(p.at);
            const label = p.at.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
            const bucket = map.get(key) ?? { key, label, long: label, total: 0, count: 0 };
            bucket.total += p.total;
            bucket.count += 1;
            map.set(key, bucket);
        }
        return { buckets: [...map.values()].sort((a, b) => a.key.localeCompare(b.key)), byDay: true };
    }

    const hours = points.map((p) => p.at.getHours());
    const first = Math.min(...hours);
    const last = Math.max(...hours);
    const buckets: Bucket[] = [];
    for (let hour = first; hour <= last; hour++) {
        const inHour = points.filter((p) => p.at.getHours() === hour);
        buckets.push({
            key: String(hour),
            label: hourLabel(hour),
            long: `${hourLong(hour)} - ${hourLong((hour + 1) % 24)}`,
            total: inHour.reduce((sum, p) => sum + p.total, 0),
            count: inHour.length,
        });
    }
    return { buckets, byDay: false };
};

/**
 * Sales pace: what came in each hour (or each day, for an event that ran over several). One
 * series in one color, so the title names it rather than a legend; hovering or tapping a bar
 * gives its exact figures, and a hidden table carries the same numbers for screen readers.
 */
const SalesByHourChart = ({ sales }: Props) => {
    const { buckets, byDay } = useMemo(() => bucketSales(sales), [sales]);
    const [focused, setFocused] = useState<number | null>(null);

    const max = Math.max(0, ...buckets.map((b) => b.total));
    const busiest = buckets.reduce<Bucket | null>(
        (best, b) => (!best || b.total > best.total ? b : best),
        null
    );
    // Crowded bars label every other one so the text never collides.
    const labelEvery = buckets.length > 14 ? 3 : buckets.length > 8 ? 2 : 1;

    return (
        <section className="rounded-xl bg-white p-4 shadow-sm dark:bg-zinc-800">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Sales by {byDay ? "day" : "hour"}
                </h2>
                {busiest && busiest.total > 0 && (
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

            {buckets.length === 0 ? (
                <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    No completed sales yet. Bars appear here as checkout completes orders.
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
                            {buckets.map((b, i) => {
                                const height = max > 0 ? Math.max(b.total > 0 ? 3 : 0, (b.total / max) * PLOT_PX) : 0;
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
                                            style={{ height }}
                                        />
                                    </button>
                                );
                            })}
                        </div>
                        <div className="mt-1 flex gap-[2px]" aria-hidden="true">
                            {buckets.map((b, i) => (
                                <span
                                    key={b.key}
                                    className="min-w-0 flex-1 truncate text-center text-[11px] text-zinc-500 dark:text-zinc-400"
                                >
                                    {i % labelEvery === 0 ? b.label : ""}
                                </span>
                            ))}
                        </div>

                        {focused !== null && buckets[focused] && (
                            <div
                                className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-zinc-900 px-2.5 py-1.5
                                    text-xs text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
                                style={{
                                    left: `${((focused + 0.5) / buckets.length) * 100}%`,
                                }}
                            >
                                <p className="font-semibold">{buckets[focused].long}</p>
                                <p className="tabular-nums">
                                    {FormatCurrency(buckets[focused].total)} &middot;{" "}
                                    {buckets[focused].count} sale
                                    {buckets[focused].count === 1 ? "" : "s"}
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
                            {buckets.map((b) => (
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
