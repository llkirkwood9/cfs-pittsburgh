import * as SecureStore from "expo-secure-store";

/**
 * Small key/value storage for the device. Sign-in tokens and the server address live in the
 * platform's secure store (Keychain on iOS, Keystore-backed on Android). Everything is also kept
 * in memory once loaded, so code that needs a value right now - the API client adding the token to
 * a request - never has to wait on the store.
 */
const cache = new Map<string, string | null>();

/** The keys the app reads before the first screen draws. */
const PRELOADED = [
    "cfs.serverUrl",
    "cfs.refreshToken",
    "cfs.lastUsername",
    "cfs.territory",
    "theme",
] as const;

/**
 * Reads every key the app needs at start-up into memory. Call once before rendering.
 */
export const LoadStorage = async (): Promise<void> => {
    await Promise.all(
        PRELOADED.map(async (key) => {
            try {
                cache.set(key, await SecureStore.getItemAsync(key));
            } catch {
                cache.set(key, null);
            }
        })
    );
};

/**
 * Reads a value from memory (loaded by LoadStorage, or set since).
 * @param key The key.
 * @returns The value, or null when there is none.
 */
export const GetItem = (key: string): string | null => cache.get(key) ?? null;

/**
 * Stores a value, or removes it when null. Memory is updated at once and the device store
 * catches up in the background.
 * @param key The key.
 * @param value The value, or null to remove it.
 */
export const SetItem = (key: string, value: string | null): void => {
    cache.set(key, value);
    const write = value === null ? SecureStore.deleteItemAsync(key) : SecureStore.setItemAsync(key, value);
    write.catch(() => undefined);
};
