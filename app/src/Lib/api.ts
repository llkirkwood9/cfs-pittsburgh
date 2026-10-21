import axios, { create, isAxiosError } from "axios";
import { SetOnline } from "./Connection";
import { GetServerUrl } from "./Server";
import { GetItem, SetItem } from "./Storage";
import type { AxiosRequestConfig } from "axios";
import type { AuthResponse } from "../Models/AuthResponse";

/**
 * Tells the API this is the phone app. A native app has no browser cookie jar, so the API hands it
 * the refresh token in the response body instead of a cookie, and reads it back from a header.
 */
const CLIENT = "app";

/** The header the refresh token travels in. */
const REFRESH_HEADER = "X-Refresh-Token";

/** Tells the API which territory a system admin or administrator is looking at. */
const TERRITORY_HEADER = "X-Territory-Id";

/** Where the refresh token is kept: the phone's secure storage (Keychain / Keystore). */
const REFRESH_TOKEN_KEY = "cfs.refreshToken";

// The app has no page origin to be relative to, so every call goes to the server it was built for.
const api = create({
    baseURL: GetServerUrl() ?? "",
    headers: { "Content-Type": "application/json" },
    timeout: 30000,
});

// The access token lives only in memory and lasts minutes; the long-lived part is the refresh
// token in secure storage, which renews it when the app opens and whenever it runs out.
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
 * Whether the device holds a session it can try to renew.
 * @returns True when a refresh token is stored.
 */
export const hasStoredSession = (): boolean => Boolean(GetItem(REFRESH_TOKEN_KEY));

/**
 * Stores or clears the access token and notifies anything watching (AuthContext).
 * @param token The new access token, or null to sign out.
 */
export const setAccessToken = (token: string | null): void => {
    accessToken = token;
    tokenListeners.forEach((listener) => listener(token));
};

/**
 * Keeps a session the API has just handed out: the access token in memory, the refresh token in
 * secure storage.
 * @param session A sign-in or refresh response.
 */
export const startSession = (session: AuthResponse): void => {
    if (session.refreshToken) SetItem(REFRESH_TOKEN_KEY, session.refreshToken);
    setAccessToken(session.accessToken ?? null);
};

/** Forgets the session on this device. */
const clearSession = (): void => {
    SetItem(REFRESH_TOKEN_KEY, null);
    setAccessToken(null);
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
 * Asks the API for a fresh access token using the stored refresh token, which it replaces with a
 * new one. Concurrent callers share one request, so several calls at once don't stampede it.
 * @returns The new session, or null when there is no session to renew.
 */
export const refreshSession = (): Promise<AuthResponse | null> => {
    if (refreshing) return refreshing;

    refreshing = (async () => {
        const stored = GetItem(REFRESH_TOKEN_KEY);
        if (!stored) {
            setAccessToken(null);
            return null;
        }
        try {
            const response = await axios.post<AuthResponse>(
                `${GetServerUrl() ?? ""}/api/auth/refresh`,
                null,
                { headers: { "X-CFS-Client": CLIENT, [REFRESH_HEADER]: stored }, timeout: 30000 }
            );
            SetOnline(true);
            startSession(response.data);
            return response.data;
        } catch (error) {
            if (isAxiosError(error) && !error.response) {
                // Offline: keep the stored session and let the connection banner explain.
                SetOnline(false);
                throw error;
            }
            clearSession();
            return null;
        } finally {
            refreshing = null;
        }
    })();

    return refreshing;
};

/**
 * Ends the session on the server and forgets it on this device.
 */
export const endSession = async (): Promise<void> => {
    const stored = GetItem(REFRESH_TOKEN_KEY);
    try {
        if (stored)
            await axios.post(`${GetServerUrl() ?? ""}/api/auth/logout`, null, {
                headers: { "X-CFS-Client": CLIENT, [REFRESH_HEADER]: stored },
                timeout: 5000,
            });
    } catch {
        // Signed out on this device either way.
    }
    clearSession();
};

api.interceptors.request.use((config) => {
    config.headers["X-CFS-Client"] = CLIENT;
    if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
    // A request may name another territory itself, such as reading a catalog to copy from.
    if (territoryId != null && !config.headers[TERRITORY_HEADER])
        config.headers[TERRITORY_HEADER] = String(territoryId);
    // Changing the password keeps this device signed in; the API knows it by its refresh token.
    if (/\/api\/auth\/change-password/i.test(config.url ?? "")) {
        const stored = GetItem(REFRESH_TOKEN_KEY);
        if (stored) config.headers[REFRESH_HEADER] = stored;
    }
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
        // from the stored refresh token and replay the request once.
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
