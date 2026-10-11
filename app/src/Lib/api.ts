import axios, { create } from "axios";
import { SetOnline } from "./Connection";
import { GetServerUrl, OnServerUrlChange } from "./Server";
import { GetItem, SetItem } from "./Storage";
import type { AxiosRequestConfig } from "axios";

const ACCESS_TOKEN_KEY = "cfs.accessToken";
const REFRESH_TOKEN_KEY = "cfs.refreshToken";

// The app has no page origin to be relative to, so every call goes to the server address set on
// the sign-in screen and remembered on the device.
const api = create({
    baseURL: GetServerUrl() ?? "",
    headers: { "Content-Type": "application/json" },
    timeout: 30000,
});

OnServerUrlChange((url) => {
    api.defaults.baseURL = url ?? "";
});

let isRefreshing = false;
let subscribers: ((token: string) => void)[] = [];
let tokenListeners: ((accessToken: string | null, refreshToken: string | null) => void)[] = [];

/**
 * Reads the stored access token.
 * @returns The access token, or null when signed out.
 */
export const getAccessToken = (): string | null => GetItem(ACCESS_TOKEN_KEY);

/**
 * Reads the stored refresh token.
 * @returns The refresh token, or null when signed out.
 */
export const getRefreshToken = (): string | null => GetItem(REFRESH_TOKEN_KEY);

/**
 * Stores or clears the token pair and notifies anything watching (AuthContext).
 * @param accessToken The new access token, or null to sign out.
 * @param refreshToken The new refresh token, or null to sign out.
 */
export const setTokens = (accessToken: string | null, refreshToken: string | null): void => {
    SetItem(ACCESS_TOKEN_KEY, accessToken);
    SetItem(REFRESH_TOKEN_KEY, refreshToken);

    tokenListeners.forEach((listener) => listener(accessToken, refreshToken));
};

/**
 * Subscribes to token changes so AuthContext can keep its state in sync.
 * @param listener Called whenever the token pair changes.
 * @returns An unsubscribe function.
 */
export const subscribeTokenChanged = (
    listener: (accessToken: string | null, refreshToken: string | null) => void
): (() => void) => {
    tokenListeners.push(listener);
    return () => {
        tokenListeners = tokenListeners.filter((l) => l !== listener);
    };
};

api.interceptors.request.use((config) => {
    // Read the address on every call, so a change on the sign-in screen applies at once.
    config.baseURL = GetServerUrl() ?? "";
    const token = getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
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
        const isRefreshCall = original?.url?.includes("/api/Auth/refresh");

        if (status !== 401 || original?._retry || isRefreshCall) return Promise.reject(error);

        const refreshToken = getRefreshToken();
        if (!refreshToken) {
            setTokens(null, null);
            return Promise.reject(error);
        }

        original._retry = true;

        // Concurrent 401s queue behind a single refresh call and replay once it lands, so a
        // tablet that fires several requests at once does not stampede the token endpoint.
        if (isRefreshing) {
            return new Promise((resolve) => {
                subscribers.push((token: string) => {
                    original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
                    resolve(api(original));
                });
            });
        }

        isRefreshing = true;

        try {
            const response = await axios.post(
                `${GetServerUrl() ?? ""}/api/Auth/refresh`,
                { refreshToken },
                { headers: { "Content-Type": "application/json" } }
            );

            const newAccess = response.data.accessToken as string;
            const newRefresh = response.data.refreshToken as string;
            setTokens(newAccess, newRefresh);

            subscribers.forEach((callback) => callback(newAccess));
            subscribers = [];

            original.headers = { ...original.headers, Authorization: `Bearer ${newAccess}` };
            return api(original);
        } catch (refreshError) {
            subscribers = [];
            setTokens(null, null);
            return Promise.reject(refreshError);
        } finally {
            isRefreshing = false;
        }
    }
);

export default api;
