import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import Text from "../Elements/Text";
import { cx } from "../../Lib/ClassNames";
import { SalesChart } from "@shared/Lib/Dashboard";
import { FormatCurrency } from "@shared/Lib/Format";
import type { SaleMoment } from "@shared/Models/DashboardStats";

type Props = {
    sales: SaleMoment[];
};

/** Chart height in points, not counting the labels underneath. */
const PLOT_PX = 150;

/**
 * Sales pace: what came in each hour (or each day, for an event that ran over several). One
 * series in one color, so the title names it rather than a legend; tapping a bar gives its exact
 * figures, and each bar reads its figures out to a screen reader.
 */
const SalesByHourChart = ({ sales }: Props) => {
    const { bars, byDay, max, busiest } = useMemo(() => SalesChart(sales, PLOT_PX), [sales]);
    const [focused, setFocused] = useState<number | null>(null);
    const [plotWidth, setPlotWidth] = useState<number>(0);

    const focusedBucket = focused !== null ? bars[focused] : null;

    return (
        <View className="rounded-xl bg-white p-4 raised-sm dark:bg-zinc-800">
            <View className="mb-3 flex-row flex-wrap items-baseline justify-between gap-2">
                <Text className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Sales by {byDay ? "day" : "hour"}
                </Text>
                {busiest && (
                    <Text className="text-xs text-zinc-600 dark:text-zinc-400">
                        Busiest: <Text className="text-xs font-semibold">{busiest.long}</Text> ·{" "}
                        {FormatCurrency(busiest.total)} from {busiest.count} sale
                        {busiest.count === 1 ? "" : "s"}
                    </Text>
                )}
            </View>

            {bars.length === 0 ? (
                <Text className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    No completed sales yet.
                </Text>
            ) : (
                <View>
                    {/* Recessive top value so the scale can be read without gridlines. */}
                    <Text className="mb-1 text-[11px] text-zinc-500 tabular-nums dark:text-zinc-400">
                        {FormatCurrency(max)}
                    </Text>
                    <View
                        className="flex-row items-end gap-[2px] border-b border-zinc-200 dark:border-zinc-700"
                        style={{ height: PLOT_PX }}
                        onLayout={(e) => setPlotWidth(e.nativeEvent.layout.width)}
                    >
                        {bars.map((b, i) => {
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
                                            focused === i
                                                ? "bg-sky-700 dark:bg-sky-500"
                                                : "bg-sky-600"
                                        )}
                                        style={{ height: b.height }}
                                    />
                                </Pressable>
                            );
                        })}
                    </View>
                    <View className="mt-1 flex-row gap-[2px]">
                        {bars.map((b) => (
                            <Text
                                key={b.key}
                                className="min-w-0 flex-1 text-center text-[11px] text-zinc-500 dark:text-zinc-400"
                                numberOfLines={1}
                            >
                                {b.showLabel ? b.label : ""}
                            </Text>
                        ))}
                    </View>

                    {focusedBucket && plotWidth > 0 && (
                        <View
                            pointerEvents="none"
                            className="absolute top-0 z-10 rounded-lg bg-zinc-900 px-2.5 py-1.5 raised-lg dark:bg-zinc-100"
                            style={{
                                left: Math.min(
                                    Math.max(0, ((focused! + 0.5) / bars.length) * plotWidth - 70),
                                    Math.max(0, plotWidth - 140)
                                ),
                                width: 140,
                            }}
                        >
                            <Text className="text-xs font-semibold text-white dark:text-zinc-900">
                                {focusedBucket.long}
                            </Text>
                            <Text className="text-xs text-white tabular-nums dark:text-zinc-900">
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
