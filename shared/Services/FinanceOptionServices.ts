import { client } from "@host";
import { CallApi } from "./CallApi";
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
    return CallApi(async () => {
        const response = await client.api.post<FinanceOption>(
            "/api/FinanceOption/financeoption",
            option
        );
        return response.data;
    }, null);
};

//************************************//
//*********** GET METHODS ************//
//************************************//

/**
 * Lists the finance options.
 * @param includeInactive Pass true from the catalog screen.
 * @param territoryId List for this territory (such as an order's) instead of the one in view.
 * @returns Options in display order, or null on failure.
 */
export const GetFinanceOptions = async (
    includeInactive = false,
    territoryId?: number | null
): Promise<FinanceOption[] | null> => {
    return CallApi(async () => {
        const response = await client.api.get<FinanceOption[]>(
            "/api/FinanceOption/financeoptions",
            {
                params:
                    territoryId == null ? { includeInactive } : { includeInactive, territoryId },
            }
        );
        return response.data;
    }, null);
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
    return CallApi(async () => {
        const response = await client.api.patch<FinanceOption>(
            "/api/FinanceOption/financeoption",
            option
        );
        return response.data;
    }, null);
};

//************************************//
//*********** PUT METHODS ************//
//************************************//

/**
 * Puts one list of finance options - the global ones, or one territory's own - in a new order.
 * @param ids Every option id of that list, in the order checkout should list them.
 * @returns The options as the catalog lists them, or null on failure.
 */
export const ReorderFinanceOptions = async (ids: number[]): Promise<FinanceOption[] | null> => {
    return CallApi(async () => {
        const response = await client.api.put<FinanceOption[]>(
            "/api/FinanceOption/financeoptions/order",
            ids
        );
        return response.data;
    }, null);
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
    return CallApi(async () => {
        const response = await client.api.delete(`/api/FinanceOption/financeoption/${id}`);
        return response.status === 200;
    }, false);
};
