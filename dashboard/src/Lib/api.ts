import axios from "axios";
import { SetOnline } from "./Connection";
import type { AxiosRequestConfig } from "axios";
import type { AuthResponse } from "../Models/AuthResponse";

// Empty when the dashboard is served by the API itself (the Docker image), so every call is
// relative to the page's own origin.
const API_URL: string = import.meta.env.VITE_API_URL ?? "";

/** Sent on session renewal and sign-out; a page on another site can't add it to a request. */
const CLIENT_HEADER = { "X-CFS-Client": "dashboard" };

/** Tells the API which territory a system admin or administrator is looking at. */
const TERRITORY_HEADER = "X-Territory-Id";

const api = axios.create({
    baseURL: API_URL,
    headers: { "Content-Type": "application/json" },
    // The session cookie rides along so the API can renew the access token.
    withCredentials: true,
});

// The access token lives only in memory, never in browser storage, so a script injected into the
// page can't lift a long-lived credential. The long-lived part is an httpOnly cookie the page
// can't read at all; a reload renews the access token from it.
let accessToken: string | null = null;
let territoryId: number | null = null;
let refreshing: Promise<AuthResponse | null> | null = null;
let tokenListeners: ((accessToken: string | null) => void)[] = [];
let passwordListeners: (() => void)[] = [];

/**
 * Reads the current access token.
 * @returns The access token, or null when signed out.
 */
export const getAccessToken = (): string | null => accessToken;

/**
 * Stores or clears the access token and notifies anything watching (AuthContext).
 * @param token The new access token, or null to sign out.
 */
export const setAccessToken = (token: string | null): void => {
    accessToken = token;
    tokenListeners.forEach((listener) => listener(token));
};

/**
 * Subscribes to access token changes so AuthContext can keep its state in sync.
 * @param listener Called whenever the token changes.
 * @returns An unsubscribe function.
 */
export const subscribeTokenChanged = (listener: (token: string | null) => void): (() => void) => {
    tokenListeners.push(listener);
    return () => {
        tokenListeners = tokenListeners.filter((l) => l !== listener);
    };
};

/**
 * Subscribes to the API saying the user has to choose a new password before carrying on.
 * @param listener Called each time.
 * @returns An unsubscribe function.
 */
export const subscribePasswordRequired = (listener: () => void): (() => void) => {
    passwordListeners.push(listener);
    return () => {
        passwordListeners = passwordListeners.filter((l) => l !== listener);
    };
};

/**
 * Sets the territory sent with every request; null means every territory (system admins and
 * administrators only - the API ignores it for everyone else).
 * @param id The territory id, or null.
 */
export const setTerritoryHeader = (id: number | null): void => {
    territoryId = id;
};

/**
 * Asks the API for a fresh access token using the session cookie. Concurrent callers share one
 * request, so a tablet firing several calls at once does not stampede the endpoint.
 * @returns The new session, or null when there is no session to renew.
 */
export const refreshSession = (): Promise<AuthResponse | null> => {
    if (refreshing) return refreshing;

    const attempt = () =>
        axios.post<AuthResponse>(`${API_URL}/api/auth/refresh`, null, {
            withCredentials: true,
            headers: CLIENT_HEADER,
        });

    refreshing = (async () => {
        try {
            let response;
            try {
                response = await attempt();
            } catch (error) {
                // Another tab may have just renewed the same session and replaced the cookie;
                // a moment later the new one is in place, so try once more before giving up.
                if (!axios.isAxiosError(error) || error.response?.status !== 401) throw error;
                await new Promise((resolve) => setTimeout(resolve, 400));
                response = await attempt();
            }
            SetOnline(true);
            setAccessToken(response.data.accessToken ?? null);
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error) && !error.response) {
                // Offline: keep whatever we have and let the connection banner explain.
                SetOnline(false);
                throw error;
            }
            setAccessToken(null);
            return null;
        } finally {
            refreshing = null;
        }
    })();

    return refreshing;
};

/**
 * Ends the session on the server and forgets the access token.
 */
export const endSession = async (): Promise<void> => {
    try {
        await axios.post(`${API_URL}/api/auth/logout`, null, {
            withCredentials: true,
            headers: CLIENT_HEADER,
        });
    } catch {
        // Signed out locally either way.
    }
    setAccessToken(null);
};

api.interceptors.request.use((config) => {
    if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
    if (territoryId != null) config.headers[TERRITORY_HEADER] = String(territoryId);
    return config;
});

api.interceptors.response.use(
    (response) => {
        SetOnline(true);
        return response;
    },
    async (error) => {
        // Any answer at all, even an error, means the server is reachable.
        SetOnline(Boolean(error.response));

        const original = error.config as AxiosRequestConfig & { _retry?: boolean };
        const status = error.response?.status;
        const isAuthCall = /\/api\/auth\/(login|refresh|logout)/i.test(original?.url ?? "");

        if (status === 403 && error.response?.data?.mustChangePassword) {
            passwordListeners.forEach((listener) => listener());
            return Promise.reject(error);
        }

        if (status !== 401 || original?._retry || isAuthCall || !accessToken) {
            return Promise.reject(error);
        }

        original._retry = true;

        // The access token is short-lived, or the account changed (role, territory). Renew it
        // from the session cookie and replay the request once.
        try {
            const session = await refreshSession();
            if (!session?.accessToken) return Promise.reject(error);

            original.headers = {
                ...original.headers,
                Authorization: `Bearer ${session.accessToken}`,
            };
            return api(original);
        } catch {
            return Promise.reject(error);
        }
    }
);

export default api;
