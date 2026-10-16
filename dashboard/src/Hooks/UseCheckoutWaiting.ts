import { useEffect, useState } from "react";
import { IsOnline } from "../Lib/Connection";
import { GetActiveEvent } from "../Services/EventServices";
import { GetCheckoutQueue } from "../Services/OrderServices";

/** How often the count is read again while the page is in view. */
const POLL_MS = 20000;

/**
 * How many orders are waiting at the checkout table for the active event, for a badge on the
 * Checkout tab. Read while the page is in view, so a hidden tab doesn't keep asking the server.
 * @param enabled False for anyone who doesn't work the checkout table.
 * @returns The number waiting; 0 when none, or when there is no active event.
 */
export const useCheckoutWaiting = (enabled: boolean): number => {
    const [waiting, setWaiting] = useState<number>(0);

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;

        const read = async () => {
            if (document.visibilityState !== "visible") return;
            const active = await GetActiveEvent();
            const queue = active?.id ? await GetCheckoutQueue(active.id) : [];
            // A failed read says nothing about the queue: keep the last count.
            if (!cancelled && IsOnline()) setWaiting(queue.length);
        };

        read();
        const timer = setInterval(read, POLL_MS);
        document.addEventListener("visibilitychange", read);
        return () => {
            cancelled = true;
            clearInterval(timer);
            document.removeEventListener("visibilitychange", read);
        };
    }, [enabled]);

    return enabled ? waiting : 0;
};
