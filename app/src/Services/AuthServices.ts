import api from "../Lib/api";
import { HandleAxiosError } from "../Lib/ErrorHandler";
import type { AuthResponse } from "../Models/AuthResponse";
import type { User } from "../Models/User";

//*************************************//
//*********** POST METHODS ************//
//*************************************//

/**
 * Signs a crew member in with their handle and PIN.
 * @param username The login handle.
 * @param pin The numeric PIN.
 * @returns The token pair and profile, or null when sign-in failed.
 */
export const Login = async (username: string, pin: string): Promise<AuthResponse | null> => {
    try {
        const response = await api.post<AuthResponse>("/api/Auth/login", { username, pin });
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};

/**
 * Changes the signed-in user's own PIN.
 * @param currentPin The PIN they sign in with now.
 * @param newPin The PIN they want instead.
 * @returns True if the PIN was changed.
 */
export const ChangePin = async (currentPin: string, newPin: string): Promise<boolean> => {
    try {
        const response = await api.post("/api/Auth/change-pin", { currentPin, newPin });
        return response.status === 200;
    } catch (error) {
        HandleAxiosError(error);
        return false;
    }
};

/**
 * Signs the current user out on the server.
 * @returns True if the operation was successful, false otherwise.
 */
export const Logout = async (): Promise<boolean> => {
    try {
        const response = await api.post("/api/Auth/logout");
        return response.status === 200;
    } catch (error) {
        HandleAxiosError(error);
        return false;
    }
};

//************************************//
//*********** GET METHODS ************//
//************************************//

/**
 * Loads the signed-in user's profile.
 * @returns The profile, or null when not signed in.
 */
export const GetCurrentUser = async (): Promise<User | null> => {
    try {
        const response = await api.get<User>("/api/Auth/me");
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};
