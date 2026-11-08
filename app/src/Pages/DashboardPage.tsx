import { useState } from "react";
import { View } from "react-native";
import EventBreakdown from "../Components/Dashboard/EventBreakdown";
import EventFilter from "../Components/Dashboard/EventFilter";
import SalesByHourChart from "../Components/Dashboard/SalesByHourChart";
import SalesStars from "../Components/Dashboard/SalesStars";
import StockWatch from "../Components/Dashboard/StockWatch";
import TerritoryComparison from "../Components/Dashboard/TerritoryComparison";
import Grid, { Cell } from "../Components/Elements/Grid";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import Page from "../Components/Elements/Page";
import SelectField from "../Components/Elements/SelectField";
import StatCard from "../Components/Elements/StatCard";
import Text from "../Components/Elements/Text";
import { useTerritory } from "@shared/Context/TerritoryContext";
import { useActiveEventChange } from "../Hooks/UseActiveEventChange";
import { useRefreshOnFocus } from "../Hooks/UseRefreshOnFocus";
import { cx } from "../Lib/ClassNames";
import { useDashboard } from "@shared/Hooks/useDashboard";
import {
    BEST_SELLERS,
    DASHBOARD_POLL_MS,
    DashboardTitle,
    RankingCategoryOptions,
    RankingEmptyText,
    RankProducts,
    TakenBy,
    UnitsSold,
    WORST_SELLERS,
} from "@shared/Lib/Dashboard";
import { FormatCurrency } from "@shared/Lib/Format";
import type { ProductTally } from "@shared/Models/DashboardStats";
import type { ProductCategory } from "@shared/Models/Product";

/** A section card with an uppercase heading. */
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View className="rounded-xl bg-white p-4 raised-sm dark:bg-zinc-800">
        <Text className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {title}
        </Text>
        {children}
    </View>
);

/**
 * Products with the units each sold, in the order given, narrowed to one category if picked and
 * cut to the first few.
 */
const ProductRanking = ({
    products,
    empty,
    limit,
}: {
    products: ProductTally[];
    empty: string;
    /** How many to show; leave out to show them all. */
    limit?: number;
}) => {
    const [category, setCategory] = useState<ProductCategory | "All">("All");
    const shown = RankProducts(products, category, limit);

    return (
        <View className="gap-3">
            <SelectField<ProductCategory | "All">
                label="Category"
                value={category}
                onChange={setCategory}
                options={RankingCategoryOptions}
            />
            {shown.length === 0 ? (
                <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                    {RankingEmptyText(category, empty)}
                </Text>
            ) : (
                <View className="gap-1">
                    {shown.map((product, index) => (
                        <View
                            key={`${product.description}-${index}`}
                            className={cx(
                                "flex-row items-center gap-3 rounded-lg px-2 py-1.5",
                                index % 2 === 0 && "bg-zinc-50 dark:bg-zinc-700/40"
                            )}
                        >
                            <Text className="w-8 text-center text-lg font-bold text-sky-700 tabular-nums dark:text-sky-400">
                                {product.quantity}
                            </Text>
                            <View className="min-w-0 flex-1">
                                <Text className="text-sm font-medium" numberOfLines={2}>
                                    {product.description}
                                </Text>
                                <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {product.brand}
                                </Text>
                            </View>
                            <Text className="text-sm font-semibold tabular-nums">
                                {FormatCurrency(product.revenue)}
                            </Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
};

/**
 * The event's stat sheet, live, or an overview of every event with each one's figures side by
 * side. Only completed sales feed the money figures; work still on the floor or at the checkout
 * table is shown separately so nobody counts it twice. It covers the territory picked in the
 * menu bar; a system admin or administrator viewing every territory also gets them side by side.
 * Pull down to refresh; it also refreshes itself every few seconds.
 */
const DashboardPage = () => {
    const { canSwitch, territoryId: territoryInView, territoryName } = useTerritory();
    const viewingAll = canSwitch && territoryInView == null;

    const {
        events,
        activeId,
        scope,
        eventId,
        stats,
        loading,
        load,
        refresh,
        switchScope,
        switchEvent,
    } = useDashboard();
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [refreshKey, setRefreshKey] = useState<number>(0);

    const checkActiveEvent = useActiveEventChange(loading ? undefined : activeId, () =>
        load(scope)
    );

    // A change of active event opens on it; otherwise the same figures, read again.
    const reload = async () => {
        if (!(await checkActiveEvent())) await refresh();
        setRefreshKey((k) => k + 1);
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await reload();
        setRefreshing(false);
    };

    // Back on this screen: read it again.
    useRefreshOnFocus(reload);

    if (loading) {
        return (
            <Page navbar>
                <ListSkeleton rows={6} />
            </Page>
        );
    }

    return (
        <Page navbar onRefresh={handleRefresh} refreshing={refreshing} className="p-3 sm:p-4">
            <Text className="mb-3 text-xl font-bold">
                {DashboardTitle(scope, viewingAll, territoryName, stats)}
            </Text>

            {viewingAll && (
                <TerritoryComparison pollMs={DASHBOARD_POLL_MS} refreshKey={refreshKey} />
            )}

            <EventFilter
                events={events}
                allPicked={scope === "all"}
                pickedEventId={eventId}
                showTerritory={viewingAll}
                onPickAll={() => switchScope("all")}
                onPickEvent={switchEvent}
                className="mb-4"
            />

            <Grid columns={{ base: 2, lg: 4 }} className="mb-4">
                <StatCard
                    label="Total sales"
                    value={FormatCurrency(stats?.totalSales)}
                    sublabel="Collected, including tax"
                    icon="fa-solid fa-sack-dollar"
                    accent="green"
                />
                <StatCard
                    label="Net sales"
                    value={FormatCurrency(stats?.netSales)}
                    // Milestone stars are an event's goal; they mean nothing summed across events.
                    badge={
                        scope === "event" && stats?.eventId ? (
                            <SalesStars net={stats?.netSales ?? 0} />
                        ) : undefined
                    }
                    sublabel="Product revenue before tax"
                    icon="fa-solid fa-receipt"
                    accent="sky"
                />
                <StatCard
                    label="Matts / adj. bases"
                    value={stats?.mattressAndBaseCount ?? 0}
                    sublabel={`${stats?.completedOrderCount ?? 0} completed sales`}
                    icon="fa-solid fa-bed"
                    accent="violet"
                />
                <StatCard
                    label="Average sale"
                    value={FormatCurrency(stats?.averageSale)}
                    sublabel={`Tax collected ${FormatCurrency(stats?.taxCollected)}`}
                    icon="fa-solid fa-chart-line"
                    accent="amber"
                />
            </Grid>

            <Grid columns={{ base: 1, lg: 3 }} gap={16} className="mb-4">
                <Cell span={{ base: 1, lg: 2 }}>
                    <Section title="Units sold">
                        <Grid columns={{ base: 2, sm: 5 }}>
                            {UnitsSold(stats).map((unit) => (
                                <View
                                    key={unit.label}
                                    className="items-center rounded-lg bg-zinc-100 p-3 dark:bg-zinc-700"
                                >
                                    <Icon
                                        icon={unit.icon}
                                        className="text-sm text-zinc-500 dark:text-zinc-400"
                                    />
                                    <Text className="mt-1 text-2xl font-bold tabular-nums">
                                        {unit.value}
                                    </Text>
                                    <Text className="text-center text-[11px] text-zinc-500 dark:text-zinc-400">
                                        {unit.label}
                                    </Text>
                                </View>
                            ))}
                        </Grid>
                    </Section>
                </Cell>

                <Section title="Taken by">
                    <View className="gap-2">
                        {TakenBy(stats).map((row) => (
                            <View
                                key={row.label}
                                className="flex-row items-baseline justify-between gap-4"
                            >
                                <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                                    {row.label}
                                </Text>
                                <Text className="font-semibold tabular-nums">
                                    {FormatCurrency(row.value)}
                                </Text>
                            </View>
                        ))}
                        {(stats?.outstandingBalance ?? 0) > 0 && (
                            <View className="flex-row items-baseline justify-between gap-4 border-t border-zinc-200 pt-2 dark:border-zinc-700">
                                <Text className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                                    Outstanding balance
                                </Text>
                                <Text className="font-bold text-amber-700 tabular-nums dark:text-amber-400">
                                    {FormatCurrency(stats?.outstandingBalance)}
                                </Text>
                            </View>
                        )}
                    </View>

                    <View className="mt-4 flex-row flex-wrap gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-700">
                        <View className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-700">
                            <Text className="text-xs">
                                {stats?.draftOrderCount ?? 0} on the floor
                            </Text>
                        </View>
                        <View className="rounded-full bg-amber-100 px-2 py-1 dark:bg-amber-900/50">
                            <Text className="text-xs text-amber-800 dark:text-amber-300">
                                {stats?.awaitingCheckoutCount ?? 0} at checkout
                            </Text>
                        </View>
                        {(stats?.voidedOrderCount ?? 0) > 0 && (
                            <View className="rounded-full bg-red-100 px-2 py-1 dark:bg-red-900/50">
                                <Text className="text-xs text-red-800 dark:text-red-300">
                                    {stats?.voidedOrderCount} voided
                                </Text>
                            </View>
                        )}
                    </View>
                </Section>
            </Grid>

            {scope === "all" && (
                <View className="mb-4">
                    <EventBreakdown events={stats?.events ?? []} onSelect={switchEvent} />
                </View>
            )}

            {/* Sales by the hour and stock levels are about one event, so the overview leaves them
                out. */}
            {scope === "event" && (
                <Grid columns={{ base: 1, lg: 3 }} gap={16} className="mb-4">
                    <Cell span={{ base: 1, lg: 2 }}>
                        <SalesByHourChart sales={stats?.sales ?? []} />
                    </Cell>
                    <StockWatch refreshKey={refreshKey} />
                </Grid>
            )}

            <Section title="Best sellers">
                <ProductRanking
                    products={stats?.topProducts ?? []}
                    empty="No sales yet."
                    limit={scope === "event" ? BEST_SELLERS : undefined}
                />
            </Section>

            {scope === "all" && (
                <View className="mt-4">
                    <Section title="Worst sellers">
                        <ProductRanking
                            products={stats?.worstProducts ?? []}
                            empty="No products yet."
                            limit={WORST_SELLERS}
                        />
                    </Section>
                </View>
            )}
        </Page>
    );
};

export default DashboardPage;
