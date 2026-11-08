import { client } from "@host";
import { CallApi } from "./CallApi";
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
    return CallApi(async () => {
        const response = await client.api.post<Event>("/api/Event/event", newEventData);
        return response.data;
    }, null);
};

//************************************//
//*********** GET METHODS ************//
//************************************//

/**
 * Lists every event, most recent first.
 * @returns All events, or null on failure.
 */
export const GetEvents = async (): Promise<Event[] | null> => {
    return CallApi(async () => {
        const response = await client.api.get<Event[]>("/api/Event/events");
        return response.data;
    }, null);
};

/**
 * Gets the active event. New orders can only be taken while one is active.
 * @returns The active event, null when none is active, or undefined on failure.
 */
export const GetActiveEvent = async (): Promise<Event | null | undefined> => {
    return CallApi(async () => {
        const response = await client.api.get<Event>("/api/Event/event/active");
        // 204 No Content means no event is active right now, which is not an error.
        return response.status === 204 ? null : response.data;
    }, undefined);
};

/**
 * Gets a single event.
 * @param id The event id.
 * @returns The event, or null on failure.
 */
export const GetEvent = async (id: number): Promise<Event | null> => {
    return CallApi(async () => {
        const response = await client.api.get<Event>(`/api/Event/event/${id}`);
        return response.data;
    }, null);
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
    return CallApi(async () => {
        const response = await client.api.patch<Event>("/api/Event/event", eventData);
        return response.data;
    }, null);
};

//***************************************//
//*********** DELETE METHODS ************//
//***************************************//

/**
 * Deletes an event that has no orders against it.
 * @param id The event id.
 * @param permanent System admin only: delete for good.
 * @returns True if the operation was successful, false otherwise.
 */
export const DeleteEvent = async (id: number, permanent = false): Promise<boolean> => {
    return CallApi(async () => {
        // permanent is system-admin-only: it deletes for good instead of archiving or refusing.
        const response = await client.api.delete(`/api/Event/event/${id}`, {
            params: permanent ? { permanent: true } : undefined,
        });
        return response.status === 200;
    }, false);
};
