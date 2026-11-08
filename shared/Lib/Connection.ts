/**
 * Whether the server can be reached. Every API response - even an error response - proves it can;
 * a request that gets no answer at all says it cannot. The connection banner watches this so a
 * dropped Wi-Fi link shows as one clear notice rather than a toast for every failed request.
 */
type Listener = (online: boolean) => void;

/**
 * Whether the screen is in front, and word of when it comes back - the page, or the app. Each
 * host provides one as `foreground` from "@host".
 */
export type Foreground = {
    /** True while the screen is in front. */
    isInFront: () => boolean;
    /**
     * Calls back each time the screen comes back to the front, or may have its connection back.
     * @returns A function that stops listening.
     */
    onReturn: (callback: () => void) => () => void;
};

let online = true;
let announced = false;
const listeners = new Set<Listener>();

/**
 * Whether the last request reached the server.
 * @returns True when connected.
 */
export const IsOnline = (): boolean => online;

/**
 * Records whether the server answered, telling any listeners when that changes.
 * @param value True when the server answered.
 */
export const SetOnline = (value: boolean): void => {
    if (online === value) return;
    online = value;
    if (value) announced = false;
    listeners.forEach((listener) => listener(value));
};

/**
 * Whether a failed request should say the server cannot be reached. True once per outage; the
 * banner covers the rest, so a dropped link does not bury the screen in identical toasts.
 * @returns True the first time it is asked during an outage.
 */
export const TakeOfflineAnnouncement = (): boolean => {
    if (announced) return false;
    announced = true;
    return true;
};

/**
 * Subscribes to connection changes.
 * @param listener Called with the new state.
 * @returns A function that unsubscribes.
 */
export const OnConnectionChange = (listener: Listener): (() => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};
