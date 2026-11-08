import { client } from "@host";
import { CallApi } from "./CallApi";
import type { DashboardStats } from "../Models/DashboardStats";
import type { TerritoryStats } from "../Models/Territory";

//************************************//
//*********** GET METHODS ************//
//************************************//

/**
 * Stat sheet figures for one event.
 * @param eventId The event id.
 * @returns The computed stat sheet, or null on failure.
 */
export const GetStatsForEvent = async (eventId: number): Promise<DashboardStats | null> => {
    return CallApi(async () => {
        const response = await client.api.get<DashboardStats>(
            `/api/Dashboard/stats/event/${eventId}`
        );
        return response.data;
    }, null);
};

/**
 * Stat sheet figures across every event in the territory in view (or every territory, for a
 * system admin or administrator viewing them all), with each event's headline figures.
 * @returns The computed stat sheet, or null on failure.
 */
export const GetStatsForAllEvents = async (): Promise<DashboardStats | null> => {
    return CallApi(async () => {
        const response = await client.api.get<DashboardStats>("/api/Dashboard/stats/all");
        return response.data;
    }, null);
};

/**
 * Every territory's headline figures side by side. System Admins and administrators only.
 * @param from First day to include (YYYY-MM-DD); leave out for no lower limit.
 * @param to Last day to include (YYYY-MM-DD); leave out for no upper limit.
 * @returns One row per territory, biggest total first, or null on failure.
 */
export const GetTerritoryComparison = async (
    from?: string,
    to?: string
): Promise<TerritoryStats[] | null> => {
    return CallApi(async () => {
        const response = await client.api.get<TerritoryStats[]>(
            "/api/Dashboard/stats/territories",
            {
                params: { from, to },
            }
        );
        return response.data;
    }, null);
};
