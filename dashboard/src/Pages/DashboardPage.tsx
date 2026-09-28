import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import Button from "../Components/Elements/Button";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import StatCard from "../Components/Elements/StatCard";
import TabButton from "../Components/Elements/TabButton";
import { useAuth } from "../Context/AuthContext";
import { FormatCurrency } from "../Lib/ModelHelpers";
import { IsOnline } from "../Lib/Connection";
import type { DashboardStats } from "../Models/DashboardStats";
import type { Event } from "../Models/Event";
import { GetStatsForDay, GetStatsForEvent } from "../Services/DashboardServices";
import { GetActiveEvent, GetEvents } from "../Services/EventServices";

/** How often the figures refresh while the page is open. */
const POLL_MS = 15000;

/**
 * The event's stat sheet, live. Only completed sales feed the money figures; work still on the
 * floor or at the checkout table is shown separately so nobody counts it twice.
 */
const DashboardPage = () => {
    const { user } = useAuth();

    const [events, setEvents] = useState<Event[]>([]);
    const [scope, setScope] = useState<"event" | "day">("event");
    const [eventId, setEventId] = useState<number | null>(null);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    const loadStats = useCallback(async (currentScope: "event" | "day", id: number | null) => {
        const result =
            currentScope === "day" ? await GetStatsForDay() : id ? await GetStatsForEvent(id) : null;
        // Keep the last figures up while the server cannot be reached, rather than showing zeros.
        if (result || IsOnline()) setStats(result);
    }, []);

    useEffect(() => {
        const load = async () => {
            setLoading(true);

            const [list, active] = await Promise.all([GetEvents(), GetActiveEvent()]);
            setEvents(list);

            const id = active?.id ?? list[0]?.id ?? null;
            setEventId(id);
            await loadStats("event", id);

            setLoading(false);
        };

        load();
    }, [loadStats]);

    useEffect(() => {
        const timer = setInterval(() => loadStats(scope, eventId), POLL_MS);
        return () => clearInterval(timer);
    }, [scope, eventId, loadStats]);

    if (!user) return <Navigate to="/unauthorized" replace />;

    const switchScope = async (next: "event" | "day") => {
        setScope(next);
        await loadStats(next, eventId);
    };

    const switchEvent = async (id: number) => {
        setEventId(id);
        setScope("event");
        await loadStats("event", id);
    };

    if (loading) {
        return (
            <div className="mx-auto max-w-screen-2xl p-4">
                <ListSkeleton rows={6} />
            </div>
        );
    }

    const units: { label: string; value: number; icon: string }[] = [
        { label: "Mattresses", value: stats?.mattressCount ?? 0, icon: "fa-solid fa-bed" },
        {
            label: "Adjustable bases",
            value: stats?.adjustableBaseCount ?? 0,
            icon: "fa-solid fa-sliders",
        },
        { label: "Purple", value: stats?.purpleCount ?? 0, icon: "fa-solid fa-star" },
        { label: "Helix", value: stats?.helixCount ?? 0, icon: "fa-solid fa-star" },
        {
            label: "Protectors",
            value: stats?.mattressProtectorCount ?? 0,
            icon: "fa-solid fa-shield",
        },
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
        <div className="mx-auto max-w-screen-2xl p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-xl font-bold">
                    {scope === "day" ? "Today across all events" : stats?.organization}
                </h1>
                <Button
                    text="Refresh"
                    icon="fa-solid fa-rotate"
                    onClick={() => loadStats(scope, eventId)}
                    className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                />
            </div>

            <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
                <TabButton
                    text="Today"
                    active={scope === "day"}
                    onClick={() => switchScope("day")}
                />
                {events.map((event) => (
                    <TabButton
                        key={event.id}
                        text={event.organization ?? ""}
                        active={scope === "event" && event.id === eventId}
                        onClick={() => event.id && switchEvent(event.id)}
                    />
                ))}
            </div>

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
                <section className="rounded-xl bg-white p-4 shadow-sm lg:col-span-2 dark:bg-zinc-800">
                    <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Units sold
                    </h2>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                        {units.map((unit) => (
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

                <section className="rounded-xl bg-white p-4 shadow-sm dark:bg-zinc-800">
                    <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Taken by
                    </h2>
                    <dl className="space-y-2">
                        {payments.map((row) => (
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

            <div className="grid grid-cols-1 gap-4">
                <section className="rounded-xl bg-white p-4 shadow-sm dark:bg-zinc-800">
                    <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Best sellers
                    </h2>
                    {(stats?.topProducts ?? []).length === 0 ? (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">No sales yet.</p>
                    ) : (
                        <ul className="space-y-1">
                            {(stats?.topProducts ?? []).map((product, index) => (
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
            </div>
        </div>
    );
};

export default DashboardPage;
