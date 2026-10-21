import api from "../Lib/api";
import { HandleAxiosError } from "../Lib/ErrorHandler";
import type { Territory } from "../Models/Territory";

//*************************************//
//*********** POST METHODS ************//
//*************************************//

/**
 * Creates a territory. System Admins and administrators only.
 * @param name Its name.
 * @param copyCatalogFromTerritoryId Another territory whose catalog it starts with a copy of; leave
 * out for an empty catalog.
 * @returns The new territory, or null on failure.
 */
export const AddTerritory = async (
    name: string,
    copyCatalogFromTerritoryId?: number | null
): Promise<Territory | null> => {
    try {
        const response = await api.post<Territory>("/api/Territory/territory", {
            name,
            copyCatalogFromTerritoryId: copyCatalogFromTerritoryId ?? undefined,
        });
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
 * Lists the territories the signed-in user can see: every one for a system admin or administrator,
 * just their own for everyone else.
 * @param includeInactive Pass true to include switched-off territories.
 * @returns The territories, or an empty list on failure.
 */
export const GetTerritories = async (includeInactive = false): Promise<Territory[]> => {
    try {
        const response = await api.get<Territory[]>("/api/Territory/territories", {
            params: { includeInactive },
        });
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return [];
    }
};

//**************************************//
//*********** PATCH METHODS ************//
//**************************************//

/**
 * Renames a territory or switches it on or off. Switching one off signs its crew out.
 * @param territory The id plus the fields to change.
 * @returns The updated territory, or null on failure.
 */
export const UpdateTerritory = async (territory: Territory): Promise<Territory | null> => {
    try {
        const response = await api.patch<Territory>("/api/Territory/territory", territory);
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
 * Deletes a territory that nothing belongs to yet.
 * @param id The territory id.
 * @returns True when it was deleted.
 */
export const DeleteTerritory = async (id: number): Promise<boolean> => {
    try {
        await api.delete(`/api/Territory/territory/${id}`);
        return true;
    } catch (error) {
        HandleAxiosError(error);
        return false;
    }
};
