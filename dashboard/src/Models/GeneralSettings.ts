/** Business details and dashboard levels an administrator sets under Settings. */
export type GeneralSettings = {
    /** In the menu bar, on the sign-in screen, in the browser tab and as the email sender. */
    appName: string;
    /** At the top of every sales sheet and at the end of the receipt email. */
    companyName: string;
    /** On every sales sheet and in emails. */
    customerServicePhone: string;
    /** Net sales that earn the dashboard's first star. */
    starsFirstAt: number;
    /** Net sales between each star after the first. */
    starsEvery: number;
    /** A counted item with this many or fewer left is flagged as running low. */
    lowStockAt: number;
    /** The values when nothing has been changed. */
    defaults?: Omit<GeneralSettings, "defaults">;
};

/** Used until the saved settings arrive, and if they can't be read. Matches the server's defaults. */
export const DefaultGeneralSettings: GeneralSettings = {
    appName: "CFS Pittsburgh",
    companyName: "Custom Fundraising Solutions",
    customerServicePhone: "440-381-2888",
    starsFirstAt: 30000,
    starsEvery: 10000,
    lowStockAt: 2,
};
