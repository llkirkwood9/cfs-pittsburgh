import Icon from "../Elements/Icon";
import {
    FormatCurrency,
    FormatShortDate,
    IsPastEvent,
    IsUpcomingEvent,
} from "../../Lib/ModelHelpers";
import type { EventTally } from "../../Models/DashboardStats";
import type { Event } from "../../Models/Event";

type Props = {
    events: EventTally[];
    /** Opens one event's own figures. */
    onSelect: (eventId: number) => void;
};

/** The parts of an event the Past and upcoming checks read. */
const AsEvent = (tally: EventTally): Event => ({
    isActive: tally.isActive,
    eventDate: tally.eventDate ?? undefined,
});

/**
 * Every event side by side, for the overview: what each one sold, with a bar for its total sales
 * so the best fundraisers stand out. Tapping one opens its own figures. Events that haven't
 * happened yet are left out, since they have no sales.
 */
const EventBreakdown = ({ events, onSelect }: Props) => {
    const shown = events.filter((e) => !IsUpcomingEvent(AsEvent(e)));
    const best = Math.max(0, ...shown.map((e) => e.totalSales ?? 0));

    return (
        <section className="rounded-xl bg-white p-4 shadow-xs dark:bg-zinc-800">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Events
            </h2>
            {shown.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No events yet.</p>
            ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-700">
                    {shown.map((event) => {
                        const total = event.totalSales ?? 0;
                        const past = IsPastEvent(AsEvent(event));
                        return (
                            <li key={event.eventId}>
                                <button
                                    type="button"
                                    onClick={() => event.eventId && onSelect(event.eventId)}
                                    className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-lg px-2 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-700/40"
                                >
                                    <span className="min-w-48 flex-1">
                                        <span className="flex flex-wrap items-center gap-2">
                                            <span className="font-semibold">
                                                {event.organization}
                                                {event.territoryName && (
                                                    <span className="font-normal text-zinc-500 dark:text-zinc-400">
                                                        {" "}
                                                        &middot; {event.territoryName}
                                                    </span>
                                                )}
                                            </span>
                                            {event.isActive && (
                                                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-900/50 dark:text-green-300">
                                                    Active
                                                </span>
                                            )}
                                            {past && (
                                                <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                                                    Past
                                                </span>
                                            )}
                                        </span>
                                        <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                                            {FormatShortDate(event.eventDate)} &middot;{" "}
                                            {event.completedOrderCount ?? 0} sale
                                            {event.completedOrderCount === 1
                                                ? ""
                                                : "s"} &middot; {event.mattressAndBaseCount ?? 0}{" "}
                                            matts/bases &middot; average{" "}
                                            {FormatCurrency(event.averageSale)}
                                        </span>
                                        {/* Total sales against the best event's. */}
                                        <span
                                            className="mt-2 block h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700"
                                            aria-hidden="true"
                                        >
                                            <span
                                                className="block h-full rounded-full bg-sky-600 dark:bg-sky-500"
                                                style={{
                                                    width: `${best > 0 ? (total / best) * 100 : 0}%`,
                                                }}
                                            />
                                        </span>
                                    </span>
                                    <span className="ml-auto w-28 shrink-0 text-right">
                                        <span className="block font-bold tabular-nums">
                                            {FormatCurrency(total)}
                                        </span>
                                        <span className="block text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                                            Net {FormatCurrency(event.netSales)}
                                        </span>
                                    </span>
                                    <Icon
                                        icon="fa-solid fa-chevron-right"
                                        className="text-xs text-zinc-400"
                                    />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
};

export default EventBreakdown;
