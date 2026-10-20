/** Which initials a statement takes; matches the order's initials fields. */
export type SalesTermKey = "customerInfo" | "warranty" | "dropShip" | "advisory";

/**
 * When the customer is asked to initial a statement: on every order, only when something on the
 * order is shipped rather than taken home, or only when an item on it has a warranty.
 */
export type AskWhen = "always" | "shipped" | "warranty";

/** The choices for when a statement is asked, as Settings words them. */
export const AskWhenOptions: { value: AskWhen; label: string }[] = [
    { value: "always", label: "Always" },
    { value: "shipped", label: "Only when something ships" },
    { value: "warranty", label: "Only when an item has a warranty" },
];

/** One statement the customer initials, on the sales sheet and on their initialling screen. */
export type SalesTerm = {
    key: SalesTermKey;
    /** The heading on the customer's initialling screen. */
    title: string;
    /** The underlined heading on the sales sheet; may be empty. */
    heading: string;
    /** The paragraph, the same in both places. **bold** and __underline__ allowed. */
    text: string;
    /** When to ask for it; skipped, it prints N/A. */
    askWhen?: AskWhen;
};

/** Business details, dashboard levels, new-event defaults and terms set under Settings. */
export type GeneralSettings = {
    /** The territory these are for; null for the company-wide settings. */
    territoryId?: number | null;
    /** Whether the signed-in user may change them. */
    canEdit?: boolean;
    /** For a territory: which settings it sets itself rather than taking the company's. */
    overridden?: string[];
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
    /** The sales tax rate a new event starts with, e.g. 0.07. */
    defaultSalesTaxRate: number;
    /** The card processing fee a new event starts with, e.g. 0.02. */
    defaultCcProcessingFeeRate: number;
    /** The four statements a customer initials, in signing order. */
    terms: SalesTerm[];
    /** Whether checkout may pick Other and type in a financing type not in the catalog. */
    allowOtherFinanceType: boolean;
    /**
     * What each setting falls back to: the built-in values for the company-wide settings, the
     * company's for a territory.
     */
    defaults?: Omit<GeneralSettings, "defaults">;
};

/** The terms as printed on the paper sales sheet. Matches the server's defaults. */
export const DefaultSalesTerms: SalesTerm[] = [
    {
        key: "customerInfo",
        title: "Check your details",
        heading: "",
        text: "Customer confirms the name, address, phone, email and delivery details above are correct.",
        askWhen: "shipped",
    },
    {
        key: "warranty",
        title: "Warranty & mattress protectors",
        heading: "Customer Service & Warranty Information",
        text:
            "All products come with a manufacturer warranty. Customer service and warranty issues are the responsibility of the manufacturer. " +
            "All manufacturers require the use of mattress protectors. They reserve the right to refuse service or invalidate the warranty if there are " +
            "any stains or soils present even if the product is defective. Customer has been notified that sleep sets must be clean, free of tears, " +
            "burns, odors, pet hair and stains of any kind for the warranty to be valid. In addition, manufacturer warranties only cover the cost of " +
            "the replacement item, not additional expenses such as delivery or set-up.",
        askWhen: "warranty",
    },
    {
        key: "dropShip",
        title: "How your bed arrives",
        heading: "Drop Ship Delivery",
        text:
            "**ALL ITEMS WILL BE DROP SHIPPED DIRECTLY TO THE CUSTOMER UNLESS OTHERWISE NOTED.** Items do not require a signature when delivered. " +
            "The mattress will be compressed, vacuum sealed and boxed. The product may be heavy and may require additional persons to move it. " +
            "Once open, the bed will completely recover within 24-48 hours, however, sleeping on it sooner will not damage the bed.",
        askWhen: "shipped",
    },
    {
        key: "advisory",
        title: "All sales are final",
        heading: "Advisory",
        text:
            "Customer acknowledges and understands that this is a sanctioned fundraising event with a portion of the proceeds allocated " +
            "directly to the above mentioned organization and therefore, **__ALL SALES AND TRANSACTIONS ARE FINAL__**.",
        askWhen: "always",
    },
];

/** Used until the saved settings arrive, and if they can't be read. Matches the server's defaults. */
export const DefaultGeneralSettings: GeneralSettings = {
    appName: "CFS",
    companyName: "CFS",
    customerServicePhone: "440-381-2888",
    starsFirstAt: 30000,
    starsEvery: 10000,
    lowStockAt: 2,
    defaultSalesTaxRate: 0.07,
    defaultCcProcessingFeeRate: 0.02,
    terms: DefaultSalesTerms,
    allowOtherFinanceType: true,
};

/**
 * A term by key, from a list that might be incomplete (an older order's copy), falling back to
 * the default wording.
 * @param terms The terms to look in.
 * @param key Which term.
 * @returns The term.
 */
export const TermFor = (terms: SalesTerm[] | null | undefined, key: SalesTermKey): SalesTerm =>
    terms?.find((t) => t.key === key) ?? DefaultSalesTerms.find((t) => t.key === key)!;
