import type { Event } from "../Models/Event";

/**
 * Today as YYYY-MM-DD in the viewer's time zone, for comparing with an event's date.
 * @returns The date key.
 */
export const TodayKey = (): string => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/**
 * An event's date as YYYY-MM-DD. Event dates are plain calendar dates, so no time zone applies.
 * @param event The event.
 * @returns The date key, or an empty string.
 */
const eventDayKey = (event: Event): string => (event.eventDate ?? "").slice(0, 10);

/**
 * Whether an event is over: not the active event, and dated before today.
 * @param event The event.
 * @returns True for a past event.
 */
export const IsPastEvent = (event: Event): boolean =>
    !event.isActive && eventDayKey(event) !== "" && eventDayKey(event) < TodayKey();

/**
 * Whether an event has not happened yet: not the active event, and dated after today. There is
 * never any data for one of these.
 * @param event The event.
 * @returns True for an upcoming event.
 */
export const IsUpcomingEvent = (event: Event): boolean =>
    !event.isActive && eventDayKey(event) > TodayKey();

/**
 * The events to offer as a filter on the Dashboard and Orders screens: the active event first,
 * then everything else newest to oldest. Upcoming events are left out - they have no sales yet.
 * @param events Every event.
 * @returns The events to show, in order.
 */
export const EventsForFilter = (events: Event[]): Event[] =>
    events
        .filter((e) => !IsUpcomingEvent(e))
        .sort(
            (a, b) =>
                Number(Boolean(b.isActive)) - Number(Boolean(a.isActive)) ||
                eventDayKey(b).localeCompare(eventDayKey(a)) ||
                (b.id ?? 0) - (a.id ?? 0)
        );

/**
 * Splits the event list for the Events screen: the active and upcoming events (active first,
 * then soonest first) and the past ones (most recent first).
 * @param events Every event.
 * @returns The two groups.
 */
export const SplitEvents = (events: Event[]): { current: Event[]; past: Event[] } => ({
    current: events
        .filter((e) => !IsPastEvent(e))
        .sort(
            (a, b) =>
                Number(Boolean(b.isActive)) - Number(Boolean(a.isActive)) ||
                eventDayKey(a).localeCompare(eventDayKey(b)) ||
                (a.id ?? 0) - (b.id ?? 0)
        ),
    past: events
        .filter(IsPastEvent)
        .sort((a, b) => eventDayKey(b).localeCompare(eventDayKey(a)) || (b.id ?? 0) - (a.id ?? 0)),
});
