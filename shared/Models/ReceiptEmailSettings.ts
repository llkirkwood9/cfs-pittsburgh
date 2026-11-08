/** A placeholder the receipt email can use, such as {FirstName}. */
export type EmailPlaceholder = {
    name?: string;
    description?: string;
};

/** The wording of the email that goes with a customer's receipt. */
export type ReceiptEmailSettings = {
    /** The territory this wording is for; null for the company-wide wording. */
    territoryId?: number | null;
    /** Whether the signed-in user may change it. */
    canEdit?: boolean;
    /** The subject line in use: the saved one, or the default. */
    subject?: string;
    /** The body in use: the saved wording, or the default. */
    body?: string;
    /** Whether the subject and body are both the defaults (for a territory: the company's). */
    isDefault?: boolean;
    defaultSubject?: string;
    defaultBody?: string;
    maxSubjectLength?: number;
    maxLength?: number;
    placeholders?: EmailPlaceholder[];
    updatedAt?: string | null;
    updatedBy?: string | null;
};

/** How a body reads for a sample order. */
export type ReceiptEmailPreview = {
    subject?: string;
    html?: string;
    /** The attachment's file name, e.g. CFS-Receipt-1017.pdf. */
    attachmentName?: string;
    /** Placeholders that aren't recognised - most likely typos. */
    unknownPlaceholders?: string[];
};
