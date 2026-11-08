/*
 * The longest text the server accepts in each field, so a form stops typing where the server
 * would refuse. Each value matches the API's own limit for that field.
 */
export const Limits = {
    /** A product's name. */
    productName: 150,
    /** A product's brand, also editable on an order line. */
    brand: 100,
    /** A product's warranty, e.g. "10 years". */
    warrantyLength: 60,
    /** A product's notes for the rep. */
    productNotes: 500,
    /** A size's name, also editable on an order line. */
    size: 50,
    /** A size's configuration, e.g. "Mattress Only". */
    configuration: 100,
    /** A size's note for the rep. */
    sizeNotes: 300,
    /** A product option's name, and each of its choices. */
    optionName: 50,
    /** A delivery or financing option's name. */
    optionListName: 100,
    /** A catalog category's name. */
    categoryName: 60,
    /** A territory's name. */
    territoryName: 100,
    /** An event's organization. */
    eventOrganization: 150,
    /** An event's cart. */
    eventCart: 100,
    /** An order line's description. */
    lineDescription: 300,
    /** An order line's note. */
    lineNotes: 500,
    /** An upcharge's reason. */
    upchargeReason: 300,
    /** An order's comments. */
    orderComments: 1000,
    /** A financing payment's type, when it isn't one of the listed options. */
    financeType: 100,
    /** A financing payment's account number. */
    financeNumber: 100,
    /** The customer's initials on an acknowledgement. */
    initials: 10,
    /** The customer's printed name beside their signature. */
    printedName: 150,
    /** A note on a stock adjustment or count. */
    inventoryNote: 300,
    /** An event's notes on the Accessory Inventory Sheet. */
    inventoryNotes: 2000,
    /** The addresses an email goes to. */
    emailTo: 500,
    /** The message with an emailed report. */
    emailMessage: 2000,
    /** A crew member's name. */
    crewName: 150,
    /** A crew member's email. */
    crewEmail: 200,
    /** A username. */
    username: 50,
    /** A password. */
    password: 128,
} as const;

/**
 * The highest default rate for a new event, as a percent. Matches the server's MaxDefaultRate
 * (an event's own rates can go to 100%): it catches a rate typed in the wrong box.
 */
export const MAX_DEFAULT_EVENT_RATE_PERCENT = 25;
