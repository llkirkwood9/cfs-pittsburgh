import { client } from "@host";
import { CallApi } from "./CallApi";
import type { User, UserRole } from "../Models/User";

//*************************************//
//*********** POST METHODS ************//
//*************************************//

/**
 * Adds a crew account.
 * @param newUserData The data for the new account.
 * @returns The created user, or null on failure.
 */
export const AddUser = async (newUserData: User): Promise<User | null> => {
    return CallApi(async () => {
        const response = await client.api.post<User>("/api/User/user", newUserData);
        return response.data;
    }, null);
};

//************************************//
//*********** GET METHODS ************//
//************************************//

/**
 * Lists every crew account.
 * @returns All users, or null on failure.
 */
export const GetUsers = async (): Promise<User[] | null> => {
    return CallApi(async () => {
        const response = await client.api.get<User[]>("/api/User/users");
        return response.data;
    }, null);
};

/**
 * Lists the roles the signed-in user may give a crew account.
 * @returns The roles, or null on failure.
 */
export const GetAssignableRoles = async (): Promise<UserRole[] | null> => {
    return CallApi(async () => {
        const response = await client.api.get<UserRole[]>("/api/User/assignable-roles");
        return response.data;
    }, null);
};

/**
 * Lists the names of active reps, for the CFS Rep Name picker.
 * @returns Rep names, or null on failure.
 */
export const GetReps = async (): Promise<string[] | null> => {
    return CallApi(async () => {
        const response = await client.api.get<string[]>("/api/User/reps");
        return response.data;
    }, null);
};

//**************************************//
//*********** PATCH METHODS ************//
//**************************************//

/**
 * Updates a crew account. The password only changes when one is supplied, and a locked account is unlocked by sending isLockedOut: false.
 * @param userData The fields to change, including the id.
 * @returns The updated user, or null on failure.
 */
export const UpdateUser = async (userData: User): Promise<User | null> => {
    return CallApi(async () => {
        const response = await client.api.patch<User>("/api/User/user", userData);
        return response.data;
    }, null);
};

//***************************************//
//*********** DELETE METHODS ************//
//***************************************//

/**
 * Deactivates a crew account.
 * @param id The user id.
 * @param permanent System admin only: delete for good.
 * @returns True if the operation was successful, false otherwise.
 */
export const DeleteUser = async (id: number, permanent = false): Promise<boolean> => {
    return CallApi(async () => {
        // permanent is system-admin-only: it deletes for good instead of archiving or refusing.
        const response = await client.api.delete(`/api/User/user/${id}`, {
            params: permanent ? { permanent: true } : undefined,
        });
        return response.status === 200;
    }, false);
};
