import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import Text from "../Elements/Text";
import { cx } from "../../Lib/ClassNames";
import { FormatCurrency, ParseServerTime } from "../../Lib/ModelHelpers";
import type { SaleMoment } from "../../Models/DashboardStats";

type Props = {
    sales: SaleMoment[];
};

type Bucket = { key: string; label: string; long: string; total: number; count: number };

/** Chart height in points, not counting the labels underneath. */
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
            const label = `${p.at.getMonth() + 1}/${p.at.getDate()}`;
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
 * series in one color, so the title names it rather than a legend; tapping a bar gives its exact
 * figures, and each bar reads its figures out to a screen reader.
 */
const SalesByHourChart = ({ sales }: Props) => {
    const { buckets, byDay } = useMemo(() => bucketSales(sales), [sales]);
    const [focused, setFocused] = useState<number | null>(null);
    const [plotWidth, setPlotWidth] = useState<number>(0);

    const max = Math.max(0, ...buckets.map((b) => b.total));
    const busiest = buckets.reduce<Bucket | null>(
        (best, b) => (!best || b.total > best.total ? b : best),
        null
    );
    // Crowded bars label every other one so the text never collides.
    const labelEvery = buckets.length > 14 ? 3 : buckets.length > 8 ? 2 : 1;
    const focusedBucket = focused !== null ? buckets[focused] : null;

    return (
        <View className="rounded-xl bg-white p-4 raised-sm dark:bg-zinc-800">
            <View className="mb-3 flex-row flex-wrap items-baseline justify-between gap-2">
                <Text className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Sales by {byDay ? "day" : "hour"}
                </Text>
                {busiest && busiest.total > 0 && (
                    <Text className="text-xs text-zinc-600 dark:text-zinc-400">
                        Busiest: <Text className="text-xs font-semibold">{busiest.long}</Text> ·{" "}
                        {FormatCurrency(busiest.total)} from {busiest.count} sale
                        {busiest.count === 1 ? "" : "s"}
                    </Text>
                )}
            </View>

            {buckets.length === 0 ? (
                <Text className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    No completed sales yet.
                </Text>
            ) : (
                <View>
                    {/* Recessive top value so the scale can be read without gridlines. */}
                    <Text className="mb-1 text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                        {FormatCurrency(max)}
                    </Text>
                    <View
                        className="flex-row items-end gap-[2px] border-b border-zinc-200 dark:border-zinc-700"
                        style={{ height: PLOT_PX }}
                        onLayout={(e) => setPlotWidth(e.nativeEvent.layout.width)}
                    >
                        {buckets.map((b, i) => {
                            const height =
                                max > 0 ? Math.max(b.total > 0 ? 3 : 0, (b.total / max) * PLOT_PX) : 0;
                            return (
                                <Pressable
                                    key={b.key}
                                    onPress={() => setFocused(focused === i ? null : i)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${b.long}: ${FormatCurrency(b.total)} from ${b.count} sale${b.count === 1 ? "" : "s"}`}
                                    className="h-full min-w-0 flex-1 items-center justify-end"
                                >
                                    {/* The whole column is the hit target; the bar is the mark. */}
                                    <View
                                        className={cx(
                                            "w-full max-w-[40px] rounded-t",
                                            focused === i ? "bg-sky-700 dark:bg-sky-500" : "bg-sky-600"
                                        )}
                                        style={{ height }}
                                    />
                                </Pressable>
                            );
                        })}
                    </View>
                    <View className="mt-1 flex-row gap-[2px]">
                        {buckets.map((b, i) => (
                            <Text
                                key={b.key}
                                className="min-w-0 flex-1 text-center text-[11px] text-zinc-500 dark:text-zinc-400"
                                numberOfLines={1}
                            >
                                {i % labelEvery === 0 ? b.label : ""}
                            </Text>
                        ))}
                    </View>

                    {focusedBucket && plotWidth > 0 && (
                        <View
                            pointerEvents="none"
                            className="absolute top-0 z-10 rounded-lg bg-zinc-900 px-2.5 py-1.5 raised-lg dark:bg-zinc-100"
                            style={{
                                left: Math.min(
                                    Math.max(0, ((focused! + 0.5) / buckets.length) * plotWidth - 70),
                                    Math.max(0, plotWidth - 140)
                                ),
                                width: 140,
                            }}
                        >
                            <Text className="text-xs font-semibold text-white dark:text-zinc-900">
                                {focusedBucket.long}
                            </Text>
                            <Text className="text-xs tabular-nums text-white dark:text-zinc-900">
                                {FormatCurrency(focusedBucket.total)} · {focusedBucket.count} sale
                                {focusedBucket.count === 1 ? "" : "s"}
                            </Text>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
};

export default SalesByHourChart;
