import axios from "axios";
import { CreateApiClient } from "@shared/Lib/ApiClient";
import { GetServerUrl } from "./Server";
import { GetItem, SetItem } from "./Storage";
import { StorageKeys } from "./StorageKeys";
import type { AuthResponse } from "@shared/Models/AuthResponse";

/**
 * Tells the API this is the phone app. A native app has no browser cookie jar, so the API hands it
 * the refresh token in the response body instead of a cookie, and reads it back from a header.
 */
const CLIENT = "app";

/** The header the refresh token travels in. */
const REFRESH_HEADER = "X-Refresh-Token";

// The app has no page origin to be relative to, so every call goes to the server it was built for.
const SERVER = GetServerUrl() ?? "";

const sessionHeaders = (refreshToken: string) => ({
    "X-CFS-Client": CLIENT,
    [REFRESH_HEADER]: refreshToken,
});

/**
 * The app's session: the refresh token is kept in the phone's secure storage (Keychain /
 * Keystore) and renews the access token when the app opens and whenever it runs out.
 */
const client = CreateApiClient({
    instance: { baseURL: SERVER, timeout: 30000 },
    hasSession: () => Boolean(GetServerUrl()) && Boolean(GetItem(StorageKeys.refreshToken)),
    renew: async () => {
        const stored = GetItem(StorageKeys.refreshToken);
        if (!stored) return null;
        const response = await axios.post<AuthResponse>(`${SERVER}/api/auth/refresh`, null, {
            headers: sessionHeaders(stored),
            timeout: 30000,
        });
        return response.data;
    },
    end: async () => {
        const stored = GetItem(StorageKeys.refreshToken);
        if (stored)
            await axios.post(`${SERVER}/api/auth/logout`, null, {
                headers: sessionHeaders(stored),
                timeout: 5000,
            });
    },
    keep: (session) => {
        if (session.refreshToken) SetItem(StorageKeys.refreshToken, session.refreshToken);
    },
    forget: () => SetItem(StorageKeys.refreshToken, null),
    headersFor: (url) => {
        // Changing the password keeps this device signed in; the API knows it by its refresh token.
        const stored = /\/api\/auth\/change-password/i.test(url)
            ? GetItem(StorageKeys.refreshToken)
            : null;
        return stored ? sessionHeaders(stored) : { "X-CFS-Client": CLIENT };
    },
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
