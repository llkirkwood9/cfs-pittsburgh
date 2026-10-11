/**
 * The web build (used for quick testing in a browser) keeps the same keys in localStorage.
 */
export const LoadStorage = async (): Promise<void> => undefined;

export const GetItem = (key: string): string | null => localStorage.getItem(key);

export const SetItem = (key: string, value: string | null): void => {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
};
