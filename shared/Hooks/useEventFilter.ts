import { useCallback, useState } from "react";
import { EventsForFilter } from "../Lib/Events";
import type { Event } from "../Models/Event";
import { GetActiveEvent, GetEvents } from "../Services/EventServices";

/**
 * The event filter strip on the Dashboard and Orders screens: the events to offer, and the active
 * event when they were last read.
 * @param withEvents Whether to read the event list at all - only those who may pick an event.
 * @returns The events, the active event's id (undefined until read) and the loader.
 */
export const useEventFilter = (withEvents: boolean) => {
    const [events, setEvents] = useState<Event[]>([]);
    const [activeId, setActiveId] = useState<number | null | undefined>(undefined);

    /**
     * Reads the events and the active one.
     * @returns The events offered, newest first, and the active event.
     */
    const loadEvents = useCallback(async () => {
        const [all, active] = await Promise.all([
            withEvents ? GetEvents() : Promise.resolve([] as Event[]),
            GetActiveEvent(),
        ]);
        const list = EventsForFilter(all ?? []);
        setEvents(list);
        setActiveId(active?.id ?? null);
        return { events: list, active: active ?? null };
    }, [withEvents]);

    return { events, activeId, loadEvents };
};
