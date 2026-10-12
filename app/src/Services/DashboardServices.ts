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
 * Stat sheet figures across every event, with each event's headline figures.
 * @returns The computed stat sheet, or null on failure.
 */
export const GetStatsForAllEvents = async (): Promise<DashboardStats | null> => {
    try {
        const response = await api.get<DashboardStats>("/api/Dashboard/stats/all");
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};
