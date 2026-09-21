import api from "../Lib/api";
import { HandleAxiosError } from "../Lib/ErrorHandler";
import type { User } from "../Models/User";

//*************************************//
//*********** POST METHODS ************//
//*************************************//

/**
 * Adds a crew account.
 * @param newUserData The data for the new account.
 * @returns The created user, or null on failure.
 */
export const AddUser = async (newUserData: User): Promise<User | null> => {
    try {
        const response = await api.post<User>("/api/User/user", newUserData);
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
 * Lists every crew account.
 * @returns All users, or an empty list on failure.
 */
export const GetUsers = async (): Promise<User[]> => {
    try {
        const response = await api.get<User[]>("/api/User/users");
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return [];
    }
};

/**
 * Lists the names of active reps, for the CFS Rep Name picker.
 * @returns Rep names, or an empty list on failure.
 */
export const GetReps = async (): Promise<string[]> => {
    try {
        const response = await api.get<string[]>("/api/User/reps");
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
 * Updates a crew account. The PIN only changes when one is supplied.
 * @param userData The fields to change, including the id.
 * @returns The updated user, or null on failure.
 */
export const UpdateUser = async (userData: User): Promise<User | null> => {
    try {
        const response = await api.patch<User>("/api/User/user", userData);
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
 * Deactivates a crew account.
 * @param id The user id.
 * @returns True if the operation was successful, false otherwise.
 */
export const DeleteUser = async (id: number): Promise<boolean> => {
    try {
        const response = await api.delete(`/api/User/user/${id}`);
        return response.status === 200;
    } catch (error) {
        HandleAxiosError(error);
        return false;
    }
};
