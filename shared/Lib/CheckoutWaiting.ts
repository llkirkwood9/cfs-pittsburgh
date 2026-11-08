/**
 * Keeps the Checkout tab's waiting count current between its own reads. The order services say
 * when they change the queue - an order sent over, completed, reopened, voided or deleted - and
 * the checkout screen passes on the count it has just read, so the badge follows it as closely as
 * the queue on screen does.
 */
type Listener = (count: number | null) => void;

const listeners = new Set<Listener>();

/** The queue has changed on this device; the badge reads it again. */
export const CheckoutQueueChanged = (): void => listeners.forEach((listener) => listener(null));

/**
 * The checkout screen has just read the queue.
 * @param count How many orders are waiting.
 */
export const CheckoutQueueCounted = (count: number): void =>
    listeners.forEach((listener) => listener(count));

/**
 * Subscribes to queue changes.
 * @param listener Called with the new count, or null when it needs reading again.
 * @returns A function that unsubscribes.
 */
export const OnCheckoutQueueChange = (listener: Listener): (() => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};
