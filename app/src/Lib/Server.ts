import axios from "axios";
import { GetItem, SetItem } from "./Storage";

const SERVER_KEY = "cfs.serverUrl";

type Listener = (url: string | null) => void;
let listeners: Listener[] = [];

/**
 * Tidies a server address as typed: adds http:// when no scheme is given (the cart's Pi serves
 * plain http on the local network) and drops any trailing slash.
 * @param value The address as typed, e.g. "192.168.1.20:8080".
 * @returns The address to use, or null when nothing was typed.
 */
export const NormalizeServerUrl = (value: string): string | null => {
    let url = value.trim();
    if (!url) return null;
    if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
    return url.replace(/\/+$/, "");
};

/**
 * The server this device talks to.
 * @returns Its address, or null before one has been set.
 */
export const GetServerUrl = (): string | null => GetItem(SERVER_KEY);

/**
 * Remembers the server address and tells anything watching (the API client).
 * @param url The normalized address, or null to forget it.
 */
export const SetServerUrl = (url: string | null): void => {
    SetItem(SERVER_KEY, url);
    listeners.forEach((listener) => listener(url));
};

/**
 * Subscribes to server address changes.
 * @param listener Called with the new address.
 * @returns An unsubscribe function.
 */
export const OnServerUrlChange = (listener: Listener): (() => void) => {
    listeners.push(listener);
    return () => {
        listeners = listeners.filter((l) => l !== listener);
    };
};

/**
 * Checks that a CFS server answers at an address, before it is saved.
 * @param url The normalized address.
 * @returns True when /health answered.
 */
export const TestServerUrl = async (url: string): Promise<boolean> => {
    try {
        const response = await axios.get(`${url}/health`, { timeout: 6000 });
        return response.status >= 200 && response.status < 300;
    } catch {
        return false;
    }
};
