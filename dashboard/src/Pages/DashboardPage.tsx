import { useState } from "react";
import Button from "../Components/Elements/Button";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import EventBreakdown from "../Components/Dashboard/EventBreakdown";
import EventFilter from "../Components/Dashboard/EventFilter";
import SalesByHourChart from "../Components/Dashboard/SalesByHourChart";
import SalesStars from "../Components/Dashboard/SalesStars";
import StockWatch from "../Components/Dashboard/StockWatch";
import TerritoryComparison from "../Components/Dashboard/TerritoryComparison";
import StatCard from "../Components/Elements/StatCard";
import { useTerritory } from "@shared/Context/TerritoryContext";
import { useDashboard } from "@shared/Hooks/useDashboard";
import {
    BEST_SELLERS,
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

/**
 * A titled list of products with the units each sold, in the order given, narrowed to one
 * category if picked and cut to the first few.
 */
const ProductRanking = ({
    title,
    products,
    empty,
    limit,
}: {
    title: string;
    products: ProductTally[];
    empty: string;
    /** How many to show; leave out to show them all. */
    limit?: number;
}) => {
    const [category, setCategory] = useState<ProductCategory | "All">("All");
    const shown = RankProducts(products, category, limit);

    return (
        <section className="rounded-xl bg-white p-4 shadow-xs dark:bg-zinc-800">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {title}
                </h2>
                <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ProductCategory | "All")}
                    aria-label={`${title} category`}
                    className="min-h-[36px] rounded-lg border border-zinc-300 bg-white px-2 text-sm
                    dark:border-zinc-600 dark:bg-zinc-800 dark:scheme-dark"
                >
                    {RankingCategoryOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>
            </div>
            {shown.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {RankingEmptyText(category, empty)}
                </p>
            ) : (
                <ul className="space-y-1">
                    {shown.map((product, index) => (
                        <li
                            key={`${product.description}-${index}`}
                            className="flex items-center gap-3 rounded-lg px-2 py-1.5 odd:bg-zinc-50 dark:odd:bg-zinc-700/40"
                        >
                            <span className="w-8 shrink-0 text-center text-lg font-bold tabular-nums text-sky-700 dark:text-sky-400">
                                {product.quantity}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="line-clamp-2 block text-sm font-medium">
                                    {product.description}
                                </span>
                                <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                                    {product.brand}
                                </span>
                            </span>
                            <span className="shrink-0 text-sm font-semibold tabular-nums">
                                {FormatCurrency(product.revenue)}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
};

/**
 * The event's stat sheet, live, or an overview of every event with each one's figures side by
 * side. Only completed sales feed the money figures; work still on the floor or at the checkout
 * table is shown separately so nobody counts it twice. It covers the
 * territory picked in the menu bar; a system admin or administrator viewing every territory also gets
 * them side by side.
 */
const DashboardPage = () => {
    const { viewingAll, territoryName } = useTerritory();

    const { events, scope, eventId, stats, loading, refresh, switchScope, switchEvent } =
        useDashboard();

    if (loading) {
        return (
            <div className="mx-auto max-w-(--breakpoint-2xl) p-4">
                <ListSkeleton rows={6} />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-(--breakpoint-2xl) p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-xl font-bold">
                    {DashboardTitle(scope, viewingAll, territoryName, stats)}
                </h1>
                <Button
                    text="Refresh"
                    icon="fa-solid fa-rotate"
                    onClick={refresh}
                    className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                />
            </div>

            {viewingAll && <TerritoryComparison />}

            <EventFilter
                events={events}
                allPicked={scope === "all"}
                pickedEventId={eventId}
                showTerritory={viewingAll}
                onPickAll={() => switchScope("all")}
                onPickEvent={switchEvent}
                className="mb-4"
            />

            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
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
            </div>

            <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <section className="rounded-xl bg-white p-4 shadow-xs lg:col-span-2 dark:bg-zinc-800">
                    <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Units sold
                    </h2>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                        {UnitsSold(stats).map((unit) => (
                            <div
                                key={unit.label}
                                className="rounded-lg bg-zinc-100 p-3 text-center dark:bg-zinc-700"
                            >
                                <Icon
                                    icon={unit.icon}
                                    className="text-sm text-zinc-500 dark:text-zinc-400"
                                />
                                <p className="mt-1 text-2xl font-bold tabular-nums">{unit.value}</p>
                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                    {unit.label}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="rounded-xl bg-white p-4 shadow-xs dark:bg-zinc-800">
                    <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Taken by
                    </h2>
                    <dl className="space-y-2">
                        {TakenBy(stats).map((row) => (
                            <div
                                key={row.label}
                                className="flex items-baseline justify-between gap-4"
                            >
                                <dt className="text-sm text-zinc-600 dark:text-zinc-400">
                                    {row.label}
                                </dt>
                                <dd className="font-semibold tabular-nums">
                                    {FormatCurrency(row.value)}
                                </dd>
                            </div>
                        ))}
                        {(stats?.outstandingBalance ?? 0) > 0 && (
                            <div className="flex items-baseline justify-between gap-4 border-t border-zinc-200 pt-2 dark:border-zinc-700">
                                <dt className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                                    Outstanding balance
                                </dt>
                                <dd className="font-bold tabular-nums text-amber-700 dark:text-amber-400">
                                    {FormatCurrency(stats?.outstandingBalance)}
                                </dd>
                            </div>
                        )}
                    </dl>

                    <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-200 pt-3 text-xs dark:border-zinc-700">
                        <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-700">
                            {stats?.draftOrderCount ?? 0} on the floor
                        </span>
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                            {stats?.awaitingCheckoutCount ?? 0} at checkout
                        </span>
                        {(stats?.voidedOrderCount ?? 0) > 0 && (
                            <span className="rounded-full bg-red-100 px-2 py-1 text-red-800 dark:bg-red-900/50 dark:text-red-300">
                                {stats?.voidedOrderCount} voided
                            </span>
                        )}
                    </div>
                </section>
            </div>

            {scope === "all" && (
                <div className="mb-4">
                    <EventBreakdown events={stats?.events ?? []} onSelect={switchEvent} />
                </div>
            )}

            {/* Sales by the hour and stock levels are about one event, so the overview leaves them
                out. */}
            {scope === "event" && (
                <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                        <SalesByHourChart sales={stats?.sales ?? []} />
                    </div>
                    <StockWatch />
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ProductRanking
                    title="Best sellers"
                    products={stats?.topProducts ?? []}
                    empty="No sales yet."
                    limit={scope === "event" ? BEST_SELLERS : undefined}
                />
                {scope === "all" && (
                    <ProductRanking
                        title="Worst sellers"
                        products={stats?.worstProducts ?? []}
                        empty="No products yet."
                        limit={WORST_SELLERS}
                    />
                )}
            </div>
        </div>
    );
};

export default DashboardPage;
