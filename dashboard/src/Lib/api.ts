import axios from "axios";
import type { AxiosRequestConfig } from "axios";

const ACCESS_TOKEN_KEY = "cfs.accessToken";
const REFRESH_TOKEN_KEY = "cfs.refreshToken";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: { "Content-Type": "application/json" },
});

let isRefreshing = false;
let subscribers: ((token: string) => void)[] = [];
let tokenListeners: ((accessToken: string | null, refreshToken: string | null) => void)[] = [];

/**
 * Reads the stored access token.
 * @returns The access token, or null when signed out.
 */
export const getAccessToken = (): string | null => localStorage.getItem(ACCESS_TOKEN_KEY);

/**
 * Reads the stored refresh token.
 * @returns The refresh token, or null when signed out.
 */
export const getRefreshToken = (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY);

/**
 * Stores or clears the token pair and notifies anything watching (AuthContext).
 * @param accessToken The new access token, or null to sign out.
 * @param refreshToken The new refresh token, or null to sign out.
 */
export const setTokens = (accessToken: string | null, refreshToken: string | null): void => {
    if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    else localStorage.removeItem(ACCESS_TOKEN_KEY);

    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    else localStorage.removeItem(REFRESH_TOKEN_KEY);

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
    const token = getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use(
    (response) => response,
    async (error) => {
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
                `${import.meta.env.VITE_API_URL}/api/Auth/refresh`,
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
