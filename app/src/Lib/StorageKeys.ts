import { SharedStorageKeys } from "@shared/Lib/StorageKeys";

/** Every key the app keeps on the device; all are read into memory before the first screen. */
export const StorageKeys = {
    refreshToken: "cfs.refreshToken",
    lastUsername: "cfs.lastUsername",
    ...SharedStorageKeys,
    theme: "theme",
} as const;
