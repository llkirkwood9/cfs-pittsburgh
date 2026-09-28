import axios from "axios";
import type { NavigateFunction } from "react-router-dom";
import { TakeOfflineAnnouncement } from "./Connection";
import { Toast } from "./Toast";

let navigate: NavigateFunction | null = null;

/**
 * Registers the router navigate function so 500s can be routed to the error page.
 * @param fn The navigate function from App.
 */
export const setNavigateFunction = (fn: NavigateFunction): void => {
    navigate = fn;
};

/**
 * Central handling for every failed API call. Services call this in their catch block and
 * return a safe default, so no component ever has to reason about an axios error shape.
 * @param error The caught error.
 */
export const HandleAxiosError = (error: unknown): void => {
    if (!axios.isAxiosError(error)) {
        Toast.Error("Something went wrong. Please try again.");
        return;
    }

    if (!error.response) {
        // The connection banner keeps saying so; one toast per outage is enough.
        if (TakeOfflineAnnouncement())
            Toast.Error("Cannot reach the server. Check the cart's connection and try again.");
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
            Toast.Warning(message ?? "You are not allowed to do that.");
            break;
        case 429:
            Toast.Warning("Slow down a moment - too many requests.");
            break;
        case 500:
            // A server fault gets its own page rather than a toast, because the rep needs
            // something they can show a manager rather than a message that disappears.
            if (navigate) {
                navigate("/error", {
                    state: { code: status, errorMessage: message, exception },
                });
            } else {
                Toast.Error(message ?? "An internal error occurred.");
            }
            break;
        default:
            Toast.Error(message ?? "Something went wrong. Please try again.");
            break;
    }
};
