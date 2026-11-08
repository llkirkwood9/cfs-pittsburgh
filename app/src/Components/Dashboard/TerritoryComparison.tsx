import { Pressable, ScrollView, View } from "react-native";
import Icon from "../Elements/Icon";
import TabButton from "../Elements/TabButton";
import Text from "../Elements/Text";
import { useTerritory } from "@shared/Context/TerritoryContext";
import { cx } from "../../Lib/ClassNames";
import { useDashboardComparison } from "@shared/Hooks/useDashboardComparison";
import { ComparisonRanges } from "@shared/Lib/Dashboard";
import { FormatCurrency } from "@shared/Lib/Format";

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
    const { range, setRange, rows, top, totals } = useDashboardComparison(pollMs, refreshKey);

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
                {ComparisonRanges.map((r) => (
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
