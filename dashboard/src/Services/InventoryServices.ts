import api from "../Lib/api";
import { HandleAxiosError } from "../Lib/ErrorHandler";
import type { InventoryAdjustment } from "../Models/InventoryAdjustment";
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
 * Recent changes to one size's count, newest first.
 * @param variantId The variant id.
 * @returns Adjustment rows, or an empty list on failure.
 */
export const GetInventoryHistory = async (variantId: number): Promise<InventoryAdjustment[]> => {
    try {
        const response = await api.get<InventoryAdjustment[]>(
            `/api/Inventory/variant/${variantId}/history`
        );
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return [];
    }
};
