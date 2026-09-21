import api from "../Lib/api";
import { HandleAxiosError } from "../Lib/ErrorHandler";
import type { DashboardStats } from "../Models/DashboardStats";

//************************************//
//*********** GET METHODS ************//
//************************************//

/**
 * Stat sheet figures for one event.
 * @param eventId The event id.
 * @returns The computed stat sheet, or null on failure.
 */
export const GetStatsForEvent = async (eventId: number): Promise<DashboardStats | null> => {
    try {
        const response = await api.get<DashboardStats>(`/api/Dashboard/stats/event/${eventId}`);
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};

/**
 * Stat sheet figures for a single calendar day across every event.
 * @param date The day to report on, as an ISO date string. Defaults to today.
 * @returns The computed stat sheet, or null on failure.
 */
export const GetStatsForDay = async (date?: string): Promise<DashboardStats | null> => {
    try {
        const response = await api.get<DashboardStats>("/api/Dashboard/stats/day", {
            params: date ? { date } : undefined,
        });
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};
