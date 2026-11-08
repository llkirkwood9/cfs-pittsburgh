import type { Event } from "../Models/Event";
import type { GeneralSettings } from "../Models/GeneralSettings";
import type { Territory } from "../Models/Territory";
import { ParseMoney, RateAsPercent } from "./Format";

/**
 * A moment's date as YYYY-MM-DD in the viewer's time zone.
 * @param date The moment.
 * @returns The date key.
 */
export const DateKey = (date: Date): string => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/**
 * Today as YYYY-MM-DD in the viewer's time zone, for comparing with an event's date.
 * @returns The date key.
 */
export const TodayKey = (): string => DateKey(new Date());

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

/** Where order numbers start for a company's first event. */
export const FIRST_ORDER_NUMBER = 1001;

/** What the event form holds while it's open. */
export type EventForm = {
    organization: string;
    cartName: string;
    /** YYYY-MM-DD. */
    eventDate: string;
    /** The sales tax rate as typed, in percent. */
    taxPercent: string;
    /** The card processing fee as typed, in percent. */
    feePercent: string;
    nextOrderNumber: string;
    isActive: boolean;
    territoryId: number | null;
};

/**
 * Fills the event form from an event, or from a new event's starting values.
 * @param event The event.
 * @param fallbackTerritoryId The territory to put it in when it has none yet.
 * @param defaults The rates a new event starts with, from Settings.
 * @returns The form.
 */
export const EventToForm = (
    event: Event,
    fallbackTerritoryId: number | null,
    defaults: Pick<GeneralSettings, "defaultSalesTaxRate" | "defaultCcProcessingFeeRate">
): EventForm => ({
    organization: event.organization ?? "",
    cartName: event.cartName ?? "",
    // Today in the viewer's own time zone - toISOString would give tomorrow's date in the evening.
    eventDate: (event.eventDate ?? TodayKey()).slice(0, 10),
    taxPercent: RateAsPercent(event.salesTaxRate ?? defaults.defaultSalesTaxRate),
    feePercent: RateAsPercent(event.ccProcessingFeeRate ?? defaults.defaultCcProcessingFeeRate),
    nextOrderNumber: String(event.nextOrderNumber ?? FIRST_ORDER_NUMBER),
    isActive: event.isActive ?? true,
    territoryId: event.territoryId ?? fallbackTerritoryId,
});

/**
 * A new event's starting values: the tax rate and card fee set under Settings, the most recent
 * event's cart, and order numbers carrying on from the highest used so far so no two sales
 * sheets share a number.
 * @param events Every event.
 * @param territoryId The territory it's for.
 * @param settings That territory's settings.
 * @returns The new event.
 */
export const NewEventDefaults = (
    events: Event[],
    territoryId: number | null,
    settings: GeneralSettings
): Event => {
    const latest = [...events].sort((a, b) =>
        (b.eventDate ?? "").localeCompare(a.eventDate ?? "")
    )[0];
    return {
        territoryId: territoryId ?? undefined,
        cartName: latest?.cartName,
        salesTaxRate: settings.defaultSalesTaxRate,
        ccProcessingFeeRate: settings.defaultCcProcessingFeeRate,
        nextOrderNumber: Math.max(FIRST_ORDER_NUMBER, ...events.map((e) => e.nextOrderNumber ?? 0)),
        isActive: true,
    };
};

/**
 * Checks the event form and builds the event to save.
 * @param form What was entered.
 * @param id The event's id, or undefined for a new one.
 * @param picksTerritory Whether the territory was picked on the form - for anyone with more
 *     than one; otherwise the server puts it in theirs.
 * @returns The event, or the reason it can't be saved.
 */
export const BuildEvent = (
    form: EventForm,
    id: number | undefined,
    picksTerritory: boolean
): { event: Event } | { problem: string } => {
    if (!form.organization.trim()) return { problem: "Enter the organization." };
    if (!form.eventDate) return { problem: "Pick the event date." };

    const tax = ParseMoney(form.taxPercent);
    if (tax === null || tax < 0 || tax > 100)
        return { problem: "The sales tax rate must be between 0 and 100 percent." };

    const fee = ParseMoney(form.feePercent);
    if (fee === null || fee < 0 || fee > 100)
        return { problem: "The card fee must be between 0 and 100 percent." };

    if (picksTerritory && form.territoryId == null)
        return { problem: "Pick the territory the event is in." };

    return {
        event: {
            id,
            organization: form.organization.trim(),
            cartName: form.cartName.trim(),
            eventDate: new Date(`${form.eventDate}T00:00:00`).toISOString(),
            salesTaxRate: tax / 100,
            ccProcessingFeeRate: fee / 100,
            nextOrderNumber: Number(form.nextOrderNumber) || FIRST_ORDER_NUMBER,
            isActive: form.isActive,
            territoryId: picksTerritory ? (form.territoryId ?? undefined) : undefined,
        },
    };
};

/**
 * The territories an event can be put in: the switched-on ones, plus the one it's in now.
 * @param territories Every territory.
 * @param territoryId The territory it's in now.
 * @returns The territories to offer.
 */
export const TerritoriesForEvent = (
    territories: Territory[],
    territoryId: number | null
): Territory[] => territories.filter((t) => t.isActive !== false || t.id === territoryId);

/**
 * What deleting an event asks first. A system admin deletes it for good with its orders;
 * anyone else can only delete one with no orders.
 * @param event The event.
 * @param permanent Whether it's deleted for good.
 * @returns The message.
 */
export const DeleteEventMessage = (event: Event, permanent: boolean): string =>
    permanent
        ? `Permanently delete ${event.organization} and every order taken at it? The sales, their payments and their sales sheets are all removed. This cannot be undone.`
        : `Delete ${event.organization}? Only an event with no orders against it can be deleted.`;
