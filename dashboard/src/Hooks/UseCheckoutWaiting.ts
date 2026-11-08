import {
    useCheckoutWaiting as useWaiting,
    type Foreground,
} from "@shared/Hooks/useCheckoutWaiting";

/** The page is in front while its tab is visible. */
const page: Foreground = {
    isInFront: () => document.visibilityState === "visible",
    onReturn: (callback) => {
        document.addEventListener("visibilitychange", callback);
        return () => document.removeEventListener("visibilitychange", callback);
    },
};

/**
 * How many orders are waiting at the checkout table for the active event, for a badge on the
 * Checkout tab. Read while the page is in view, so a hidden tab doesn't keep asking the server.
 * @param enabled False for anyone who doesn't work the checkout table, or with no one territory in
 * view.
 * @param territoryId The territory in view; the count is read again when it changes.
 * @returns The number waiting; 0 when none, or when there is no active event.
 */
export const useCheckoutWaiting = (enabled: boolean, territoryId: number | null): number =>
    useWaiting(page, enabled, territoryId);
