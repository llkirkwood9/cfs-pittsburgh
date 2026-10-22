import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Icon from "../Elements/Icon";
import TabButton from "../Elements/TabButton";
import Text from "../Elements/Text";
import { useTerritory } from "../../Context/TerritoryContext";
import { cx } from "../../Lib/ClassNames";
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

/** A date as YYYY-MM-DD in the device's own time zone. */
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
    /** Changes when the page is pulled down, to read the figures again. */
    refreshKey?: number;
};

/**
 * Every territory side by side, for a system admin or administrator viewing all of them: completed
 * sales and the headline figures over the chosen dates. Tapping a territory switches the whole
 * app to it.
 */
const TerritoryComparison = ({ pollMs, refreshKey = 0 }: Props) => {
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
    }, [range, load, pollMs, refreshKey]);

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

    const meta = "text-xs text-zinc-500 dark:text-zinc-400";

    return (
        <View className="mb-4 rounded-xl bg-white p-4 raised-sm dark:bg-zinc-800">
            <Text className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Territories side by side
            </Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-3"
                contentContainerClassName="gap-1.5 pb-1"
            >
                {ranges.map((r) => (
                    <TabButton
                        key={r.key}
                        text={r.label}
                        active={range === r.key}
                        onClick={() => setRange(r.key)}
                        className="min-h-[36px] px-3"
                    />
                ))}
            </ScrollView>

            {rows === null ? (
                <Text className="py-4 text-sm text-zinc-500 dark:text-zinc-400">Loading...</Text>
            ) : rows.length === 0 ? (
                <Text className="py-4 text-sm text-zinc-500 dark:text-zinc-400">
                    No territories yet. Add one under More, Territories.
                </Text>
            ) : (
                <View>
                    {rows.map((row, index) => (
                        <Pressable
                            key={row.territoryId}
                            onPress={() => setTerritoryId(row.territoryId ?? null)}
                            accessibilityRole="button"
                            accessibilityLabel={`View ${row.territoryName}, ${FormatCurrency(row.totalSales)}`}
                            className={cx(
                                "gap-1 rounded-lg px-2 py-3 active:bg-zinc-50 dark:active:bg-zinc-700/40",
                                index > 0 && "border-t border-zinc-100 dark:border-zinc-700"
                            )}
                        >
                            <View className="flex-row items-center justify-between gap-3">
                                <Text className="min-w-0 flex-1 font-semibold text-sky-700 dark:text-sky-400">
                                    {row.territoryName}
                                    {row.isActive === false && (
                                        <Text className="text-xs font-normal text-zinc-500">
                                            {" "}
                                            (off)
                                        </Text>
                                    )}
                                </Text>
                                <Text className="font-semibold tabular-nums">
                                    {FormatCurrency(row.totalSales)}
                                </Text>
                            </View>
                            <View className="h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700">
                                <View
                                    className="h-full rounded-full bg-sky-600 dark:bg-sky-400"
                                    style={{ width: `${((row.totalSales ?? 0) / top) * 100}%` }}
                                />
                            </View>
                            <View className="flex-row flex-wrap items-center gap-x-2">
                                {row.activeEvent ? (
                                    <View className="flex-row items-center gap-1">
                                        <Icon
                                            icon="fa-solid fa-circle-play"
                                            className="text-xs text-green-600 dark:text-green-400"
                                        />
                                        <Text className={meta}>{row.activeEvent}</Text>
                                    </View>
                                ) : (
                                    <Text className={meta}>No active event</Text>
                                )}
                                <Text className={meta}>
                                    {row.completedOrderCount ?? 0} sale
                                    {row.completedOrderCount === 1 ? "" : "s"}
                                </Text>
                                <Text className={meta}>net {FormatCurrency(row.netSales)}</Text>
                                <Text className={meta}>
                                    average {FormatCurrency(row.averageSale)}
                                </Text>
                                <Text className={meta}>
                                    {row.mattressCount ?? 0} matts / {row.adjustableBaseCount ?? 0}{" "}
                                    bases
                                </Text>
                            </View>
                        </Pressable>
                    ))}

                    {rows.length > 1 && (
                        <View className="gap-0.5 border-t-2 border-zinc-200 px-2 pt-3 dark:border-zinc-600">
                            <View className="flex-row items-center justify-between gap-3">
                                <Text className="font-bold">All territories</Text>
                                <Text className="font-bold tabular-nums">
                                    {FormatCurrency(totals.total)}
                                </Text>
                            </View>
                            <Text className={meta}>
                                {totals.orders} sale{totals.orders === 1 ? "" : "s"} · net{" "}
                                {FormatCurrency(totals.net)} · average{" "}
                                {FormatCurrency(totals.orders ? totals.total / totals.orders : 0)} ·{" "}
                                {totals.mattresses} matts / {totals.bases} bases
                            </Text>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
};

export default TerritoryComparison;
