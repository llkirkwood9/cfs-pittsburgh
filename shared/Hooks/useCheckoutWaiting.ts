import { useEffect, useState } from "react";
import { foreground } from "@host";
import { useAuth } from "../Context/AuthContext";
import { useTerritory } from "../Context/TerritoryContext";
import { OnCheckoutQueueChange } from "../Lib/CheckoutWaiting";
import { GetActiveEvent } from "../Services/EventServices";
import { GetCheckoutQueue } from "../Services/OrderServices";

/** How often the count is read again while the screen is in front. */
const POLL_MS = 20000;

/**
 * How many orders are waiting at the checkout table for the active event, for a badge on the
 * Checkout tab. Read while the screen is in front, so a hidden one doesn't keep asking the
 * server, and again whenever this device changes the queue.
 * Nothing is read for anyone who doesn't work the checkout table, or with every territory in view,
 * where there's no one checkout table to count; it is read again when the territory changes.
 * @returns The number waiting; 0 when none, or when there is no active event.
 */
export const useCheckoutWaiting = (): number => {
    const { hasRole } = useAuth();
    const { territoryId, viewingAll } = useTerritory();
    const enabled = hasRole("Checkout") && !viewingAll;
    const [waiting, setWaiting] = useState<number>(0);

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        // When the count last came from somewhere else - the checkout screen reading the queue.
        let heardAt = 0;

        const read = async () => {
            if (!foreground.isInFront()) return;
            const active = await GetActiveEvent();
            if (active === undefined) return;
            const queue = active?.id ? await GetCheckoutQueue(active.id) : [];
            // A failed read says nothing about the queue: keep the last count.
            if (!cancelled && queue) setWaiting(queue.length);
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
        const stopListening = foreground.onReturn(read);
        return () => {
            cancelled = true;
            unsubscribe();
            clearInterval(timer);
            stopListening();
        };
    }, [enabled, territoryId]);

    return enabled ? waiting : 0;
};
