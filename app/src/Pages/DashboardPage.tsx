import { Redirect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import EventBreakdown from "../Components/Dashboard/EventBreakdown";
import SalesByHourChart from "../Components/Dashboard/SalesByHourChart";
import SalesStars from "../Components/Dashboard/SalesStars";
import StockWatch from "../Components/Dashboard/StockWatch";
import TerritoryComparison from "../Components/Dashboard/TerritoryComparison";
import Grid, { Cell } from "../Components/Elements/Grid";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import Page from "../Components/Elements/Page";
import StatCard from "../Components/Elements/StatCard";
import TabButton from "../Components/Elements/TabButton";
import Text from "../Components/Elements/Text";
import { useAuth } from "../Context/AuthContext";
import { useTerritory } from "../Context/TerritoryContext";
import { useActiveEventChange } from "../Hooks/UseActiveEventChange";
import { useRefreshOnFocus } from "../Hooks/UseRefreshOnFocus";
import { cx } from "../Lib/ClassNames";
import { IsOnline } from "../Lib/Connection";
import { EventsForFilter, FormatCurrency, IsPastEvent } from "../Lib/ModelHelpers";
import type { DashboardStats, ProductTally } from "../Models/DashboardStats";
import type { Event } from "../Models/Event";
import { GetStatsForAllEvents, GetStatsForEvent } from "../Services/DashboardServices";
import { GetActiveEvent, GetEvents } from "../Services/EventServices";

/** How often the figures refresh while the page is open. */
const POLL_MS = 15000;

/** A section card with an uppercase heading. */
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View className="rounded-xl bg-white p-4 raised-sm dark:bg-zinc-800">
        <Text className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {title}
        </Text>
        {children}
    </View>
);

/** Products with the units each sold, in the order given. */
const ProductRanking = ({ products, empty }: { products: ProductTally[]; empty: string }) =>
    products.length === 0 ? (
        <Text className="text-sm text-zinc-500 dark:text-zinc-400">{empty}</Text>
    ) : (
        <View className="gap-1">
            {products.map((product, index) => (
                <View
                    key={`${product.description}-${index}`}
                    className={cx(
                        "flex-row items-center gap-3 rounded-lg px-2 py-1.5",
                        index % 2 === 0 && "bg-zinc-50 dark:bg-zinc-700/40"
                    )}
                >
                    <Text className="w-8 text-center text-lg font-bold tabular-nums text-sky-700 dark:text-sky-400">
                        {product.quantity}
                    </Text>
                    <View className="min-w-0 flex-1">
                        <Text className="text-sm font-medium" numberOfLines={2}>
                            {product.description}
                        </Text>
                        <Text className="text-xs text-zinc-500 dark:text-zinc-400">{product.brand}</Text>
                    </View>
                    <Text className="text-sm font-semibold tabular-nums">
                        {FormatCurrency(product.revenue)}
                    </Text>
                </View>
            ))}
        </View>
    );

/**
 * The event's stat sheet, live, or an overview of every event with each one's figures side by
 * side. Only completed sales feed the money figures; work still on the floor or at the checkout
 * table is shown separately so nobody counts it twice. It covers the territory picked in the
 * menu bar; a system admin or administrator viewing every territory also gets them side by side.
 * Pull down to refresh; it also refreshes itself every few seconds.
 */
const DashboardPage = () => {
    const { user } = useAuth();
    const { canSwitch, territoryId: territoryInView, territoryName } = useTerritory();
    const viewingAll = canSwitch && territoryInView == null;

    const [events, setEvents] = useState<Event[]>([]);
    const [scope, setScope] = useState<"event" | "all">("event");
    const [eventId, setEventId] = useState<number | null>(null);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [refreshKey, setRefreshKey] = useState<number>(0);

    // The active event when the page last loaded, so a change of event can be noticed.
    const [activeId, setActiveId] = useState<number | null | undefined>(undefined);

    const fetchStats = useCallback(
        (currentScope: "event" | "all", id: number | null) =>
            currentScope === "all"
                ? GetStatsForAllEvents()
                : id
                  ? GetStatsForEvent(id)
                  : Promise.resolve(null),
        []
    );

    /**
     * Shows a scope's figures. The scope changes together with its figures, so one scope is never
     * shown with another's - the overview's net sales lighting up an event's stars.
     */
    const show = useCallback(
        async (nextScope: "event" | "all", id: number | null) => {
            const result = await fetchStats(nextScope, id);
            // Keep the last figures up while the server cannot be reached, rather than showing zeros.
            if (!result && !IsOnline()) return;
            setScope(nextScope);
            setEventId(id);
            setStats(result);
        },
        [fetchStats]
    );

    // Opens on the active event, or the latest one when none is active; the overview stays put.
    const load = useCallback(
        async (currentScope: "event" | "all") => {
            const [all, active] = await Promise.all([GetEvents(), GetActiveEvent()]);
            const list = EventsForFilter(all);
            setEvents(list);
            setActiveId(active?.id ?? null);
            await show(currentScope, active?.id ?? list[0]?.id ?? null);
        },
        [show]
    );

    useEffect(() => {
        load("event").finally(() => setLoading(false));
    }, [load]);

    const checkActiveEvent = useActiveEventChange(loading ? undefined : activeId, () => load(scope));

    useEffect(() => {
        const timer = setInterval(() => show(scope, eventId), POLL_MS);
        return () => clearInterval(timer);
    }, [scope, eventId, show]);

    const switchScope = (next: "event" | "all") => show(next, eventId);

    const switchEvent = (id: number) => show("event", id);

    // A change of active event opens on it; otherwise the same figures, read again.
    const reload = async () => {
        if (!(await checkActiveEvent())) await show(scope, eventId);
        setRefreshKey((k) => k + 1);
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await reload();
        setRefreshing(false);
    };

    // Back on this screen: read it again.
    useRefreshOnFocus(reload);

    if (!user) return <Redirect href="/unauthorized" />;

    if (loading) {
        return (
            <Page navbar>
                <ListSkeleton rows={6} />
            </Page>
        );
    }

    const units: { label: string; value: number; icon: string }[] = [
        { label: "Mattresses", value: stats?.mattressCount ?? 0, icon: "fa-solid fa-bed" },
        { label: "Adjustable bases", value: stats?.adjustableBaseCount ?? 0, icon: "fa-solid fa-sliders" },
        { label: "Purple", value: stats?.purpleCount ?? 0, icon: "fa-solid fa-star" },
        { label: "Helix", value: stats?.helixCount ?? 0, icon: "fa-solid fa-star" },
        { label: "Protectors", value: stats?.mattressProtectorCount ?? 0, icon: "fa-solid fa-shield" },
        { label: "Pillows", value: stats?.pillowCount ?? 0, icon: "fa-solid fa-cloud" },
        { label: "Sheets", value: stats?.sheetCount ?? 0, icon: "fa-solid fa-layer-group" },
        { label: "Frames", value: stats?.frameCount ?? 0, icon: "fa-solid fa-border-all" },
        { label: "Bean bags", value: stats?.beanBagChairCount ?? 0, icon: "fa-solid fa-couch" },
        { label: "Other", value: stats?.miscCount ?? 0, icon: "fa-solid fa-box" },
    ];

    const payments: { label: string; value: number }[] = [
        { label: "Credit/debit cards", value: stats?.creditCardTotal ?? 0 },
        { label: "Cash", value: stats?.cashTotal ?? 0 },
        { label: "Checks", value: stats?.checkTotal ?? 0 },
        { label: "Financing balance", value: stats?.financingTotal ?? 0 },
        { label: "Layaway balance", value: stats?.layawayTotal ?? 0 },
    ];

    return (
        <Page navbar onRefresh={handleRefresh} refreshing={refreshing} className="p-3 sm:p-4">
            <Text className="mb-3 text-xl font-bold">
                {scope === "all"
                    ? viewingAll
                        ? "All events in every territory"
                        : `All ${territoryName ? `${territoryName} ` : ""}events`
                    : stats?.organization}
            </Text>

            {viewingAll && <TerritoryComparison pollMs={POLL_MS} refreshKey={refreshKey} />}

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-4"
                contentContainerClassName="gap-2 pb-1"
            >
                <TabButton
                    text="All events"
                    active={scope === "all"}
                    onClick={() => switchScope("all")}
                />
                {events.map((event) => (
                    <TabButton
                        key={event.id}
                        text={
                            viewingAll && event.territoryName
                                ? `${event.organization ?? ""} · ${event.territoryName}`
                                : (event.organization ?? "")
                        }
                        tag={IsPastEvent(event) ? "Past" : undefined}
                        active={scope === "event" && event.id === eventId}
                        onClick={() => event.id && switchEvent(event.id)}
                    />
                ))}
            </ScrollView>

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
                    badge={scope === "event" && stats?.eventId ? <SalesStars net={stats?.netSales ?? 0} /> : undefined}
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
                            {units.map((unit) => (
                                <View
                                    key={unit.label}
                                    className="items-center rounded-lg bg-zinc-100 p-3 dark:bg-zinc-700"
                                >
                                    <Icon icon={unit.icon} className="text-sm text-zinc-500 dark:text-zinc-400" />
                                    <Text className="mt-1 text-2xl font-bold tabular-nums">{unit.value}</Text>
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
                        {payments.map((row) => (
                            <View key={row.label} className="flex-row items-baseline justify-between gap-4">
                                <Text className="text-sm text-zinc-600 dark:text-zinc-400">{row.label}</Text>
                                <Text className="font-semibold tabular-nums">{FormatCurrency(row.value)}</Text>
                            </View>
                        ))}
                        {(stats?.outstandingBalance ?? 0) > 0 && (
                            <View className="flex-row items-baseline justify-between gap-4 border-t border-zinc-200 pt-2 dark:border-zinc-700">
                                <Text className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                                    Outstanding balance
                                </Text>
                                <Text className="font-bold tabular-nums text-amber-700 dark:text-amber-400">
                                    {FormatCurrency(stats?.outstandingBalance)}
                                </Text>
                            </View>
                        )}
                    </View>

                    <View className="mt-4 flex-row flex-wrap gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-700">
                        <View className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-700">
                            <Text className="text-xs">{stats?.draftOrderCount ?? 0} on the floor</Text>
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
                <ProductRanking products={stats?.topProducts ?? []} empty="No sales yet." />
            </Section>

            {scope === "all" && (
                <View className="mt-4">
                    <Section title="Worst sellers">
                        <ProductRanking products={stats?.worstProducts ?? []} empty="No products yet." />
                    </Section>
                </View>
            )}
        </Page>
    );
};

export default DashboardPage;
