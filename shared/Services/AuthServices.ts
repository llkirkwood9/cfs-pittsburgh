import { client } from "@host";
import { CallApi } from "./CallApi";
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
    return CallApi(async () => {
        const response = await client.api.post<AuthResponse>("/api/auth/login", {
            username,
            password,
        });
        return response.data;
    }, null);
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
    return CallApi(async () => {
        const response = await client.api.post<User>(
            "/api/auth/change-password",
            { currentPassword, newPassword },
            // Keeps this device signed in; the API knows it by its session.
            { keepSession: true }
        );
        return response.data;
    }, null);
};

//************************************//
//*********** GET METHODS ************//
//************************************//

/**
 * Loads the signed-in user's profile.
 * @returns The profile, or null when not signed in.
 */
export const GetCurrentUser = async (): Promise<User | null> => {
    return CallApi(async () => {
        const response = await client.api.get<User>("/api/auth/me");
        return response.data;
    }, null);
};

/** The server's password rules. */
export type PasswordPolicy = {
    /** The shortest password it accepts. */
    minLength?: number;
    /** The rules in words. */
    description?: string;
};

/**
 * The password rules, for the screens where one is chosen.
 * @returns The rules, or null if they couldn't be loaded.
 */
export const GetPasswordPolicy = async (): Promise<PasswordPolicy | null> => {
    try {
        const response = await client.api.get<PasswordPolicy>("/api/auth/password-policy");
        return response.data;
    } catch {
        return null;
    }
};
