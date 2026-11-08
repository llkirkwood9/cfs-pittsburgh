import { useCallback, useEffect, useState } from "react";
import { IsOnline } from "../Lib/Connection";
import { DASHBOARD_POLL_MS } from "../Lib/Dashboard";
import type { DashboardScope } from "../Lib/Dashboard";
import type { DashboardStats } from "../Models/DashboardStats";
import { GetStatsForAllEvents, GetStatsForEvent } from "../Services/DashboardServices";
import { useEventFilter } from "./useEventFilter";

/**
 * The dashboard's figures: one event's or every event's, read again every few seconds.
 * @returns The screen's state and handlers.
 */
export const useDashboard = () => {
    const { events, activeId, loadEvents } = useEventFilter(true);
    const [scope, setScope] = useState<DashboardScope>("event");
    const [eventId, setEventId] = useState<number | null>(null);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    /**
     * Shows a scope's figures. The scope changes together with its figures, so one scope is never
     * shown with another's - the overview's net sales lighting up an event's stars.
     */
    const show = useCallback(async (nextScope: DashboardScope, id: number | null) => {
        const result =
            nextScope === "all"
                ? await GetStatsForAllEvents()
                : id
                  ? await GetStatsForEvent(id)
                  : null;
        // Keep the last figures up while the server cannot be reached, rather than showing zeros.
        if (!result && !IsOnline()) return;
        setScope(nextScope);
        setEventId(id);
        setStats(result);
    }, []);

    /**
     * Reads the events, then shows the active event, or the latest one when none is active.
     * @param currentScope What to show - the overview stays put.
     */
    const load = useCallback(
        async (currentScope: DashboardScope) => {
            const { events: list, active } = await loadEvents();
            await show(currentScope, active?.id ?? list[0]?.id ?? null);
        },
        [loadEvents, show]
    );

    useEffect(() => {
        load("event").finally(() => setLoading(false));
    }, [load]);

    useEffect(() => {
        const timer = setInterval(() => show(scope, eventId), DASHBOARD_POLL_MS);
        return () => clearInterval(timer);
    }, [scope, eventId, show]);

    return {
        events,
        activeId,
        scope,
        eventId,
        stats,
        loading,
        load,
        /** Reads the figures shown again. */
        refresh: () => show(scope, eventId),
        switchScope: (next: DashboardScope) => show(next, eventId),
        switchEvent: (id: number) => show("event", id),
    };
};
