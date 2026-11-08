import { isAxiosError } from "axios";
import { OFFLINE_MESSAGE, ShowServerError, Toast } from "@host";
import { TakeOfflineAnnouncement } from "./Connection";

/** What the error page shows for a server fault. */
export type ServerErrorDetails = {
    code: number;
    errorMessage?: string;
    exception?: string;
};

/**
 * Central handling for every failed API call. Services call this in their catch block and
 * return a safe default, so no component ever has to reason about an axios error shape.
 * @param error The caught error.
 */
export const HandleAxiosError = (error: unknown): void => {
    if (!isAxiosError(error)) {
        Toast.Error("Something went wrong. Please try again.");
        return;
    }

    if (!error.response) {
        // The connection banner keeps saying so; one toast per outage is enough.
        if (TakeOfflineAnnouncement()) Toast.Error(OFFLINE_MESSAGE);
        return;
    }

    const { status, data } = error.response;
    const message = (data as { error?: string })?.error;
    const exception = (data as { exception?: string })?.exception;

    switch (status) {
        case 400:
        case 404:
            Toast.Error(message ?? "That request could not be completed.");
            break;
        case 401:
            Toast.Warning(message ?? "Please sign in again.");
            break;
        case 403:
            // The change-password screen takes over; a toast as well would just be noise.
            if ((data as { mustChangePassword?: boolean })?.mustChangePassword) break;
            Toast.Warning(message ?? "You are not allowed to do that.");
            break;
        case 429:
            // A locked account says how long for; the general limit doesn't.
            Toast.Warning(message ?? "Slow down a moment - too many requests.");
            break;
        case 500:
            // A server fault gets its own page rather than a toast, because the rep needs
            // something they can show a manager rather than a message that disappears.
            if (!ShowServerError({ code: status, errorMessage: message, exception }))
                Toast.Error(message ?? "An internal error occurred.");
            break;
        default:
            Toast.Error(message ?? "Something went wrong. Please try again.");
            break;
    }
};
