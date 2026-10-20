import api from "../Lib/api";
import { HandleAxiosError } from "../Lib/ErrorHandler";
import type { FinanceOption } from "../Models/FinanceOption";

//*************************************//
//*********** POST METHODS ************//
//*************************************//

/**
 * Adds a finance option at the end of the list.
 * @param option The new option.
 * @returns The created option, or null on failure.
 */
export const AddFinanceOption = async (option: FinanceOption): Promise<FinanceOption | null> => {
    try {
        const response = await api.post<FinanceOption>("/api/FinanceOption/financeoption", option);
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
 * Lists the finance options.
 * @param includeInactive Pass true from the catalog screen.
 * @returns Options in display order, or an empty list on failure.
 */
export const GetFinanceOptions = async (includeInactive = false): Promise<FinanceOption[]> => {
    try {
        const response = await api.get<FinanceOption[]>("/api/FinanceOption/financeoptions", {
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
 * Renames a finance option or switches it on or off at checkout.
 * @param option The fields to change, including the id.
 * @returns The updated option, or null on failure.
 */
export const UpdateFinanceOption = async (option: FinanceOption): Promise<FinanceOption | null> => {
    try {
        const response = await api.patch<FinanceOption>("/api/FinanceOption/financeoption", option);
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};

//************************************//
//*********** PUT METHODS ************//
//************************************//

/**
 * Puts the finance options in a new order.
 * @param ids Every option id, in the order checkout should list them.
 * @returns The options in their new order, or null on failure.
 */
export const ReorderFinanceOptions = async (ids: number[]): Promise<FinanceOption[] | null> => {
    try {
        const response = await api.put<FinanceOption[]>(
            "/api/FinanceOption/financeoptions/order",
            ids
        );
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
 * Removes a finance option. Sales already recorded with it keep its name.
 * @param id The finance option id.
 * @returns True if the operation was successful, false otherwise.
 */
export const DeleteFinanceOption = async (id: number): Promise<boolean> => {
    try {
        const response = await api.delete(`/api/FinanceOption/financeoption/${id}`);
        return response.status === 200;
    } catch (error) {
        HandleAxiosError(error);
        return false;
    }
};
