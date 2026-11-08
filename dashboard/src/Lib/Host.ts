import type { NavigateFunction } from "react-router-dom";
import type { ServerErrorDetails } from "@shared/Lib/ErrorHandler";

/*
 * What the shared code (../../shared, imported as @shared) needs from the dashboard: the API
 * client, toasts, and the way to the error page. The shared code imports this module as "@host".
 */
export {
    default as api,
    endSession,
    hasStoredSession,
    refreshSession,
    setTerritoryHeader,
    startSession,
    subscribePasswordRequired,
    subscribeTokenChanged,
} from "./api";
export { Toast } from "./Toast";

export const OFFLINE_MESSAGE =
    "Cannot reach the server. Check the cart's connection and try again.";

let navigate: NavigateFunction | null = null;

/**
 * Registers the router navigate function so server faults can be routed to the error page.
 * @param fn The navigate function from App.
 */
export const setNavigateFunction = (fn: NavigateFunction): void => {
    navigate = fn;
};

/**
 * Opens the error page for a server fault.
 * @param details What to show.
 * @returns False when the router isn't ready yet, so the caller falls back to a toast.
 */
export const ShowServerError = (details: ServerErrorDetails): boolean => {
    if (!navigate) return false;
    navigate("/error", { state: details });
    return true;
};

/** The dashboard is served by the API, or told its address when it is built. */
export const HAS_SERVER = true;

/**
 * Small key/value storage on this device. Private browsing may refuse it: then nothing is
 * remembered.
 */
export const DeviceStorage = {
    get: (key: string): string | null => {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    },
    set: (key: string, value: string | null): void => {
        try {
            if (value === null) localStorage.removeItem(key);
            else localStorage.setItem(key, value);
        } catch {
            // Private browsing: just not remembered.
        }
    },
};
