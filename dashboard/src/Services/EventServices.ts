import api from "../Lib/api";
import { HandleAxiosError } from "../Lib/ErrorHandler";
import type { Event } from "../Models/Event";

//*************************************//
//*********** POST METHODS ************//
//*************************************//

/**
 * Adds an event and makes it the active one.
 * @param newEventData The data for the new event.
 * @returns The created event, or null on failure.
 */
export const AddEvent = async (newEventData: Event): Promise<Event | null> => {
    try {
        const response = await api.post<Event>("/api/Event/event", newEventData);
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};

//************************************//
//*********** GET METHODS ************//
//************************************//

/**
 * Lists every event, most recent first.
 * @returns All events, or an empty list on failure.
 */
export const GetEvents = async (): Promise<Event[]> => {
    try {
        const response = await api.get<Event[]>("/api/Event/events");
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return [];
    }
};

/**
 * Gets the active event. New orders can only be taken while one is active.
 * @returns The active event, or null when none is active.
 */
export const GetActiveEvent = async (): Promise<Event | null> => {
    try {
        const response = await api.get<Event>("/api/Event/event/active");
        // 204 No Content means no event is active right now, which is not an error.
        return response.status === 204 ? null : response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};

/**
 * Gets a single event.
 * @param id The event id.
 * @returns The event, or null on failure.
 */
export const GetEvent = async (id: number): Promise<Event | null> => {
    try {
        const response = await api.get<Event>(`/api/Event/event/${id}`);
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};

//**************************************//
//*********** PATCH METHODS ************//
//**************************************//

/**
 * Updates an event.
 * @param eventData The fields to change, including the id.
 * @returns The updated event, or null on failure.
 */
export const UpdateEvent = async (eventData: Event): Promise<Event | null> => {
    try {
        const response = await api.patch<Event>("/api/Event/event", eventData);
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};

//***************************************//
//*********** DELETE METHODS ************//
//***************************************//

/**
 * Deletes an event that has no orders against it.
 * @param id The event id.
 * @returns True if the operation was successful, false otherwise.
 */
export const DeleteEvent = async (id: number): Promise<boolean> => {
    try {
        const response = await api.delete(`/api/Event/event/${id}`);
        return response.status === 200;
    } catch (error) {
        HandleAxiosError(error);
        return false;
    }
};
