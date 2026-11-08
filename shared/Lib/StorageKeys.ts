/** Device storage keys the shared code uses; the app reads every one into memory at start-up. */
export const SharedStorageKeys = {
    territory: "cfs.territory",
    theme: "theme",
    lastUsername: "cfs.lastUsername",
} as const;
