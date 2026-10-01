/** A placeholder the receipt email can use, such as {FirstName}. */
export type EmailPlaceholder = {
    name?: string;
    description?: string;
};

/** The wording of the email that goes with a customer's receipt. */
export type ReceiptEmailSettings = {
    /** The body in use: the saved wording, or the default. */
    body?: string;
    isDefault?: boolean;
    defaultBody?: string;
    maxLength?: number;
    placeholders?: EmailPlaceholder[];
    updatedAt?: string | null;
    updatedBy?: string | null;
};

/** How a body reads for a sample order. */
export type ReceiptEmailPreview = {
    subject?: string;
    html?: string;
    /** Placeholders that aren't recognised - most likely typos. */
    unknownPlaceholders?: string[];
};
