import { useEffect, useState } from "react";
import { OnCheckoutQueueChange } from "../Lib/CheckoutWaiting";
import { IsOnline } from "../Lib/Connection";
import { GetActiveEvent } from "../Services/EventServices";
import { GetCheckoutQueue } from "../Services/OrderServices";

/** How often the count is read again while the page is in view. */
const POLL_MS = 20000;

/**
 * How many orders are waiting at the checkout table for the active event, for a badge on the
 * Checkout tab. Read while the page is in view, so a hidden tab doesn't keep asking the server,
 * and again whenever this device changes the queue.
 * @param enabled False for anyone who doesn't work the checkout table, or with no one territory in
 * view.
 * @param territoryId The territory in view; the count is read again when it changes.
 * @returns The number waiting; 0 when none, or when there is no active event.
 */
export const useCheckoutWaiting = (enabled: boolean, territoryId: number | null): number => {
    const [waiting, setWaiting] = useState<number>(0);

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        // When the count last came from somewhere else - the checkout screen reading the queue.
        let heardAt = 0;

        const read = async () => {
            if (document.visibilityState !== "visible") return;
            const active = await GetActiveEvent();
            const queue = active?.id ? await GetCheckoutQueue(active.id) : [];
            // A failed read says nothing about the queue: keep the last count.
            if (!cancelled && IsOnline()) setWaiting(queue.length);
        };

        // The checkout screen reads the queue more often than this does; while it is open, its
        // count is enough.
        const poll = () => {
            if (Date.now() - heardAt >= POLL_MS) read();
        };

        // Sending an order over, completing, reopening, voiding or deleting one on this device
        // updates the count at once.
        const unsubscribe = OnCheckoutQueueChange((count) => {
            if (count === null) {
                read();
                return;
            }
            heardAt = Date.now();
            setWaiting(count);
        });

        read();
        const timer = setInterval(poll, POLL_MS);
        document.addEventListener("visibilitychange", read);
        return () => {
            cancelled = true;
            unsubscribe();
            clearInterval(timer);
            document.removeEventListener("visibilitychange", read);
        };
    }, [enabled, territoryId]);

    return enabled ? waiting : 0;
};
