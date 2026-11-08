import { router } from "expo-router";
import { GetServerUrl } from "./Server";
import { GetItem, SetItem } from "./Storage";
import type { ServerErrorDetails } from "@shared/Lib/ErrorHandler";

/*
 * What the shared code (../../shared, imported as @shared) needs from the app: the API client,
 * toasts, and the way to the error page. The shared code imports this module as "@host".
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
    "Cannot reach the server. Check this device's Wi-Fi and the server address, then try again.";

/**
 * Opens the error page for a server fault.
 * @param details What to show.
 * @returns False when the router can't navigate yet, so the caller falls back to a toast.
 */
export const ShowServerError = ({ code, errorMessage, exception }: ServerErrorDetails): boolean => {
    try {
        router.push({
            pathname: "/error",
            params: {
                code: String(code),
                errorMessage: errorMessage ?? "",
                exception: exception ?? "",
            },
        });
        return true;
    } catch {
        return false;
    }
};

/** A build made without a server address has nothing to talk to. */
export const HAS_SERVER = Boolean(GetServerUrl());

/** Small key/value storage on this device (secure storage, read into memory at start-up). */
export const DeviceStorage = { get: GetItem, set: SetItem };
