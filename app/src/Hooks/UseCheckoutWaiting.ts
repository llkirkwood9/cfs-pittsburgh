import { AppState } from "react-native";
import {
    useCheckoutWaiting as useWaiting,
    type Foreground,
} from "@shared/Hooks/useCheckoutWaiting";

/** The app is in front while it is active, so a phone in a pocket doesn't keep asking. */
const app: Foreground = {
    isInFront: () => AppState.currentState === "active",
    onReturn: (callback) => {
        const subscription = AppState.addEventListener("change", (state) => {
            if (state === "active") callback();
        });
        return () => subscription.remove();
    },
};

/**
 * How many orders are waiting at the checkout table for the active event, for a badge on the
 * Checkout tab. Read while the app is in front.
 * @param enabled False for anyone who doesn't work the checkout table, or with no one territory in
 * view.
 * @param territoryId The territory in view; the count is read again when it changes.
 * @returns The number waiting; 0 when none, or when there is no active event.
 */
export const useCheckoutWaiting = (enabled: boolean, territoryId: number | null): number =>
    useWaiting(app, enabled, territoryId);
