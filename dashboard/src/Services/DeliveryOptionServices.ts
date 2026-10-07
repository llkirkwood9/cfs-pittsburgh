import api from "../Lib/api";
import { HandleAxiosError } from "../Lib/ErrorHandler";
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
    try {
        const response = await api.post<DeliveryOption>(
            "/api/DeliveryOption/deliveryoption",
            newOptionData
        );
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
 * Lists the delivery options.
 * @param includeInactive Pass true from the admin screen.
 * @returns Options in display order, or an empty list on failure.
 */
export const GetDeliveryOptions = async (includeInactive = false): Promise<DeliveryOption[]> => {
    try {
        const response = await api.get<DeliveryOption[]>("/api/DeliveryOption/deliveryoptions", {
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
 * Updates a delivery option.
 * @param optionData The fields to change, including the id.
 * @returns The updated option, or null on failure.
 */
export const UpdateDeliveryOption = async (
    optionData: DeliveryOption
): Promise<DeliveryOption | null> => {
    try {
        const response = await api.patch<DeliveryOption>(
            "/api/DeliveryOption/deliveryoption",
            optionData
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
 * Removes a delivery option, or archives it when it already appears on an order.
 * @param id The delivery option id.
 * @param permanent System admin only: delete for good.
 * @returns True if the operation was successful, false otherwise.
 */
export const DeleteDeliveryOption = async (id: number, permanent = false): Promise<boolean> => {
    try {
        // permanent is system-admin-only: it deletes for good instead of archiving or refusing.
        const response = await api.delete(`/api/DeliveryOption/deliveryoption/${id}`, {
            params: permanent ? { permanent: true } : undefined,
        });
        return response.status === 200;
    } catch (error) {
        HandleAxiosError(error);
        return false;
    }
};
