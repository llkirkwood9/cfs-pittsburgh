import api from "../Lib/api";
import { HandleAxiosError } from "../Lib/ErrorHandler";
import type { AuthResponse } from "../Models/AuthResponse";
import type { User } from "../Models/User";

//*************************************//
//*********** POST METHODS ************//
//*************************************//

/**
 * Signs a crew member in. The API answers with a short-lived access token and sets the session
 * cookie itself.
 * @param username The login handle.
 * @param password Their password (or, once, the PIN they used before passwords).
 * @returns The access token and profile, or null when sign-in failed.
 */
export const Login = async (username: string, password: string): Promise<AuthResponse | null> => {
    try {
        const response = await api.post<AuthResponse>("/api/auth/login", { username, password });
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};

/**
 * Changes the signed-in user's own password. Every other device they were signed in on is
 * signed out.
 * @param currentPassword The password they sign in with now.
 * @param newPassword The password they want instead.
 * @returns The updated profile, or null if it wasn't changed.
 */
export const ChangePassword = async (
    currentPassword: string,
    newPassword: string
): Promise<User | null> => {
    try {
        const response = await api.post<User>("/api/auth/change-password", {
            currentPassword,
            newPassword,
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
 * Loads the signed-in user's profile.
 * @returns The profile, or null when not signed in.
 */
export const GetCurrentUser = async (): Promise<User | null> => {
    try {
        const response = await api.get<User>("/api/auth/me");
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};

/**
 * The password rules in words, for the screens where one is chosen.
 * @returns The description, or null if it couldn't be loaded.
 */
export const GetPasswordPolicy = async (): Promise<string | null> => {
    try {
        const response = await api.get<{ description?: string }>("/api/auth/password-policy");
        return response.data.description ?? null;
    } catch {
        return null;
    }
};
