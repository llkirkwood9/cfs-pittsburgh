import { client } from "@host";
import { CallApi } from "./CallApi";
import type { DeliveryOption } from "../Models/DeliveryOption";

//*************************************//
//*********** POST METHODS ************//
//*************************************//

/**
 * Adds a delivery option.
 * @param newOptionData The data for the new option.
 * @returns The created option, or null on failure.
 */
export const AddDeliveryOption = async (
    newOptionData: DeliveryOption
): Promise<DeliveryOption | null> => {
    return CallApi(async () => {
        const response = await client.api.post<DeliveryOption>(
            "/api/DeliveryOption/deliveryoption",
            newOptionData
        );
        return response.data;
    }, null);
};

//************************************//
//*********** GET METHODS ************//
//************************************//

/**
 * Lists the delivery options.
 * @param includeInactive Pass true from the admin screen.
 * @returns Options in display order, or null on failure.
 */
export const GetDeliveryOptions = async (
    includeInactive = false
): Promise<DeliveryOption[] | null> => {
    return CallApi(async () => {
        const response = await client.api.get<DeliveryOption[]>(
            "/api/DeliveryOption/deliveryoptions",
            {
                params: { includeInactive },
            }
        );
        return response.data;
    }, null);
};

//************************************//
//*********** PUT METHODS ************//
//************************************//

/**
 * Puts the delivery options in a new order - the order the sales floor offers them in.
 * @param ids Every option id, archived ones included, in the new order.
 * @returns The options in their new order, or null on failure.
 */
export const ReorderDeliveryOptions = async (ids: number[]): Promise<DeliveryOption[] | null> => {
    return CallApi(async () => {
        const response = await client.api.put<DeliveryOption[]>(
            "/api/DeliveryOption/deliveryoptions/order",
            ids
        );
        return response.data;
    }, null);
};

//**************************************//
//*********** PATCH METHODS ************//
//**************************************//

/**
 * Updates a delivery option.
 * @param optionData The fields to change, including the id.
 * @returns The updated option, or null on failure.
 */
export const UpdateDeliveryOption = async (
    optionData: DeliveryOption
): Promise<DeliveryOption | null> => {
    return CallApi(async () => {
        const response = await client.api.patch<DeliveryOption>(
            "/api/DeliveryOption/deliveryoption",
            optionData
        );
        return response.data;
    }, null);
};

//***************************************//
//*********** DELETE METHODS ************//
//***************************************//

/**
 * Removes a delivery option, or archives it when it already appears on an order.
 * @param id The delivery option id.
 * @param permanent System admin only: delete for good.
 * @returns True if the operation was successful, false otherwise.
 */
export const DeleteDeliveryOption = async (id: number, permanent = false): Promise<boolean> => {
    return CallApi(async () => {
        // permanent is system-admin-only: it deletes for good instead of archiving or refusing.
        const response = await client.api.delete(`/api/DeliveryOption/deliveryoption/${id}`, {
            params: permanent ? { permanent: true } : undefined,
        });
        return response.status === 200;
    }, false);
};
