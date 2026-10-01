import api from "../Lib/api";
import { HandleAxiosError } from "../Lib/ErrorHandler";
import type { GeneralSettings } from "../Models/GeneralSettings";
import type { ReceiptEmailPreview, ReceiptEmailSettings } from "../Models/ReceiptEmailSettings";

//*************************************//
//*********** POST METHODS ************//
//*************************************//

/**
 * Shows how a receipt email reads for a sample order, without saving it.
 * @param subject The subject line to try.
 * @param body The wording to try.
 * @returns The subject and body as they would be sent, or null on failure.
 */
export const PreviewReceiptEmail = async (
    subject: string,
    body: string
): Promise<ReceiptEmailPreview | null> => {
    try {
        const response = await api.post<ReceiptEmailPreview>(
            "/api/Settings/receipt-email/preview",
            { subject, body }
        );
        return response.data;
    } catch {
        // Runs as the administrator types, so a failure just leaves the last preview showing
        // rather than raising a message on every keystroke.
        return null;
    }
};

//************************************//
//*********** GET METHODS ************//
//************************************//

/**
 * Gets the business details and dashboard levels. Works signed out, for the sign-in screen.
 * @returns The settings, or null when they can't be read (the defaults are used instead).
 */
export const GetGeneralSettings = async (): Promise<GeneralSettings | null> => {
    try {
        const response = await api.get<GeneralSettings>("/api/Settings/general");
        return response.data;
    } catch {
        // Quietly: every screen carries on with the default details.
        return null;
    }
};

/**
 * Gets the receipt email's subject and wording, the defaults and the placeholders it can use.
 * @returns The settings, or null on failure.
 */
export const GetReceiptEmailSettings = async (): Promise<ReceiptEmailSettings | null> => {
    try {
        const response = await api.get<ReceiptEmailSettings>("/api/Settings/receipt-email");
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};

//************************************//
//*********** PUT METHODS ************//
//************************************//

/**
 * Saves business details and dashboard levels. Fields left out keep their values.
 * @param changes The settings to change.
 * @returns The settings in force afterwards, or null on failure.
 */
export const SaveGeneralSettings = async (
    changes: Partial<Omit<GeneralSettings, "defaults">>
): Promise<GeneralSettings | null> => {
    try {
        const response = await api.put<GeneralSettings>("/api/Settings/general", changes);
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};

/**
 * Saves the receipt email's subject and wording. Empty values go back to the defaults.
 * @param subject The subject line.
 * @param body The wording.
 * @returns The settings as saved, or null on failure.
 */
export const SaveReceiptEmailSettings = async (
    subject: string,
    body: string
): Promise<ReceiptEmailSettings | null> => {
    try {
        const response = await api.put<ReceiptEmailSettings>("/api/Settings/receipt-email", {
            subject,
            body,
        });
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};
