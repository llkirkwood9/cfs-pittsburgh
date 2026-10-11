import api from "../Lib/api";
import { HandleAxiosError } from "../Lib/ErrorHandler";
import type { InventoryAdjustment, InventoryCount } from "../Models/InventoryAdjustment";
import type { InventoryItem } from "../Models/InventoryItem";

//*************************************//
//*********** POST METHODS ************//
//*************************************//

/**
 * Changes the on-hand count of one tracked size, by an amount (change) or to a counted total
 * (setTo).
 * @param adjustment The variant id, change or setTo, and an optional note.
 * @returns The updated inventory row, or null on failure.
 */
export const AdjustInventory = async (
    adjustment: InventoryAdjustment
): Promise<InventoryItem | null> => {
    try {
        const response = await api.post<InventoryItem>("/api/Inventory/adjust", adjustment);
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};

/**
 * Saves the end-of-event shelf count. Each counted size is set to what was found.
 * @param count The event, an optional note and the counted sizes.
 * @returns The event's inventory rows after the count, or null on failure.
 */
export const SaveInventoryCount = async (
    count: InventoryCount
): Promise<InventoryItem[] | null> => {
    try {
        const response = await api.post<InventoryItem[]>("/api/Inventory/count", count);
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};

/**
 * Saves the notes printed in the Notes box of an event's Accessory Inventory Sheet.
 * @param eventId The event.
 * @param notes The notes; an empty string clears them.
 * @returns The saved notes (null when cleared), or undefined on failure.
 */
export const SaveInventoryNotes = async (
    eventId: number,
    notes: string
): Promise<string | null | undefined> => {
    try {
        const response = await api.put<{ notes?: string | null }>(
            `/api/Inventory/notes/event/${eventId}`,
            { notes }
        );
        return response.data.notes ?? null;
    } catch (error) {
        HandleAxiosError(error);
        return undefined;
    }
};

//************************************//
//*********** GET METHODS ************//
//************************************//

/**
 * Lists every tracked size with its on-hand count.
 * @param eventId Optional event, to include what its Take With sales used.
 * @returns Inventory rows in catalog order, or an empty list on failure.
 */
export const GetInventory = async (eventId?: number): Promise<InventoryItem[]> => {
    try {
        const response = await api.get<InventoryItem[]>("/api/Inventory/items", {
            params: eventId ? { eventId } : undefined,
        });
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return [];
    }
};

/**
 * Recent changes to one size's count (or one combination of its choices), newest first.
 * @param variantId The variant id.
 * @param stockKey Which combination of counted choices; empty for stock kept per size.
 * @returns Adjustment rows, or an empty list on failure.
 */
export const GetInventoryHistory = async (
    variantId: number,
    stockKey?: string
): Promise<InventoryAdjustment[]> => {
    try {
        const response = await api.get<InventoryAdjustment[]>(
            `/api/Inventory/variant/${variantId}/history`,
            { params: stockKey ? { stockKey } : undefined }
        );
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return [];
    }
};
