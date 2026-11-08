import axios from "axios";
import { CreateApiClient } from "@shared/Lib/ApiClient";
import type { AuthResponse } from "@shared/Models/AuthResponse";

// Empty when the dashboard is served by the API itself (the Docker image), so every call is
// relative to the page's own origin.
const API_URL: string = import.meta.env.VITE_API_URL ?? "";

/** Sent on session renewal and sign-out; a page on another site can't add it to a request. */
const CLIENT_HEADER = { "X-CFS-Client": "dashboard" };

const renewOnce = () =>
    axios.post<AuthResponse>(`${API_URL}/api/auth/refresh`, null, {
        withCredentials: true,
        headers: CLIENT_HEADER,
    });

/**
 * The dashboard's session: the long-lived part is an httpOnly cookie the page can't read at all,
 * so a reload renews the access token from it.
 */
const client = CreateApiClient({
    // The session cookie rides along so the API can renew the access token.
    instance: { baseURL: API_URL, withCredentials: true },
    hasSession: () => true,
    renew: async () => {
        try {
            return (await renewOnce()).data;
        } catch (error) {
            // Another tab may have just renewed the same session and replaced the cookie; a moment
            // later the new one is in place, so try once more before giving up.
            if (!axios.isAxiosError(error) || error.response?.status !== 401) throw error;
            await new Promise((resolve) => setTimeout(resolve, 400));
            return (await renewOnce()).data;
        }
    },
    end: async () => {
        await axios.post(`${API_URL}/api/auth/logout`, null, {
            withCredentials: true,
            headers: CLIENT_HEADER,
        });
    },
    keep: () => undefined,
    forget: () => undefined,
    headersFor: () => ({}),
});

export const {
    hasStoredSession,
    startSession,
    refreshSession,
    endSession,
    subscribeTokenChanged,
    subscribePasswordRequired,
    setTerritoryHeader,
} = client;

export default client.api;
