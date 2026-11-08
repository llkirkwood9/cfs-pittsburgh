import axios, { isAxiosError } from "axios";
import type { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import { SetOnline } from "./Connection";
import type { AuthResponse } from "../Models/AuthResponse";

/** Tells the API which territory a system admin or administrator is looking at. */
export const TERRITORY_HEADER = "X-Territory-Id";

/**
 * How a host keeps the long-lived half of a session. The dashboard leaves it in an httpOnly cookie
 * the page can't read; the phone app keeps a refresh token in secure storage and sends it in a
 * header. Everything else about a session is the same on both.
 */
export type SessionTransport = {
    /** Settings for the axios instance every service call goes through. */
    instance: AxiosRequestConfig;
    /** Whether there is a session this device could try to renew. */
    hasSession: () => boolean;
    /** Asks the server for a new access token; throws on failure, null when nothing to renew. */
    renew: () => Promise<AuthResponse | null>;
    /** Tells the server the session is over. */
    end: () => Promise<void>;
    /** Keeps whatever long-lived part of a new session the host holds itself. */
    keep: (session: AuthResponse) => void;
    /** Forgets it. */
    forget: () => void;
    /** Headers the host adds to a request, by its url. */
    headersFor: (url: string) => Record<string, string>;
};

export type ApiClient = {
    api: AxiosInstance;
    hasStoredSession: () => boolean;
    startSession: (session: AuthResponse) => void;
    refreshSession: () => Promise<AuthResponse | null>;
    endSession: () => Promise<void>;
    subscribeTokenChanged: (listener: (token: string | null) => void) => () => void;
    subscribePasswordRequired: (listener: () => void) => () => void;
    setTerritoryHeader: (id: number | null) => void;
};

/**
 * The API client both front ends use: an axios instance that carries the access token and the
 * territory being looked at, renews a run-out access token once and replays the request, and
 * reports whether the server can be reached.
 * @param transport How this host keeps a session.
 * @returns The client.
 */
export const CreateApiClient = (transport: SessionTransport): ApiClient => {
    const api = axios.create({
        headers: { "Content-Type": "application/json" },
        ...transport.instance,
    });

    // The access token lives only in memory and lasts minutes, so a script that gets into the page
    // can't lift a long-lived credential from storage.
    let accessToken: string | null = null;
    let territoryId: number | null = null;
    let refreshing: Promise<AuthResponse | null> | null = null;
    let tokenListeners: ((accessToken: string | null) => void)[] = [];
    let passwordListeners: (() => void)[] = [];

    const setAccessToken = (token: string | null): void => {
        accessToken = token;
        tokenListeners.forEach((listener) => listener(token));
    };

    const startSession = (session: AuthResponse): void => {
        transport.keep(session);
        setAccessToken(session.accessToken ?? null);
    };

    const clearSession = (): void => {
        transport.forget();
        setAccessToken(null);
    };

    // Concurrent callers share one request, so several calls at once don't stampede the endpoint.
    const refreshSession = (): Promise<AuthResponse | null> => {
        if (refreshing) return refreshing;

        refreshing = (async () => {
            try {
                const session = await transport.renew();
                if (!session) {
                    clearSession();
                    return null;
                }
                SetOnline(true);
                startSession(session);
                return session;
            } catch (error) {
                if (isAxiosError(error) && !error.response) {
                    // Offline: keep the session and let the connection banner explain.
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

    const endSession = async (): Promise<void> => {
        try {
            await transport.end();
        } catch {
            // Signed out on this device either way.
        }
        clearSession();
    };

    api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
        Object.entries(transport.headersFor(config.url ?? "")).forEach(([name, value]) => {
            config.headers[name] = value;
        });
        if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
        // A request may name another territory itself, such as reading a catalog to copy from.
        if (territoryId != null && !config.headers[TERRITORY_HEADER])
            config.headers[TERRITORY_HEADER] = String(territoryId);
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
            // and replay the request once.
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

    return {
        api,
        hasStoredSession: transport.hasSession,
        startSession,
        refreshSession,
        endSession,
        subscribeTokenChanged: (listener) => {
            tokenListeners.push(listener);
            return () => {
                tokenListeners = tokenListeners.filter((l) => l !== listener);
            };
        },
        subscribePasswordRequired: (listener) => {
            passwordListeners.push(listener);
            return () => {
                passwordListeners = passwordListeners.filter((l) => l !== listener);
            };
        },
        // Null means every territory (system admins and administrators only - the API ignores it
        // for everyone else).
        setTerritoryHeader: (id) => {
            territoryId = id;
        },
    };
};
