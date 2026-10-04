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
 * @param territoryId The territory whose business details fill the placeholders; null for the company's.
 * @returns The subject and body as they would be sent, or null on failure.
 */
export const PreviewReceiptEmail = async (
    subject: string,
    body: string,
    territoryId: number | null = null
): Promise<ReceiptEmailPreview | null> => {
    try {
        const response = await api.post<ReceiptEmailPreview>(
            "/api/Settings/receipt-email/preview",
            { subject, body },
            { params: { territoryId: territoryId ?? undefined } }
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
 * Gets what the sign-in screen may show before anyone signs in: the app name.
 * @returns The public settings, or null when they can't be read.
 */
export const GetPublicSettings = async (): Promise<{ appName?: string } | null> => {
    try {
        const response = await api.get<{ appName?: string }>("/api/Settings/public");
        return response.data;
    } catch {
        return null;
    }
};

/**
 * Gets the business details and dashboard levels in force for a territory.
 * @param territoryId The territory; null for the company-wide settings (or, for crew, their own territory's).
 * @returns The settings, or null when they can't be read (the defaults are used instead).
 */
export const GetGeneralSettings = async (
    territoryId: number | null = null
): Promise<GeneralSettings | null> => {
    try {
        const response = await api.get<GeneralSettings>("/api/Settings/general", {
            params: { territoryId: territoryId ?? undefined },
        });
        return response.data;
    } catch {
        // Quietly: every screen carries on with the default details.
        return null;
    }
};

/**
 * Gets the receipt email's subject and wording, the defaults and the placeholders it can use.
 * @param territoryId The territory; null for the company-wide wording.
 * @returns The settings, or null on failure.
 */
export const GetReceiptEmailSettings = async (
    territoryId: number | null = null
): Promise<ReceiptEmailSettings | null> => {
    try {
        const response = await api.get<ReceiptEmailSettings>("/api/Settings/receipt-email", {
            params: { territoryId: territoryId ?? undefined },
        });
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
 * Saves business details and dashboard levels. Fields left out keep their values. For a
 * territory, a value equal to the company's (or empty) goes back to following the company.
 * @param changes The settings to change.
 * @param territoryId The territory; null for the company-wide settings.
 * @returns The settings in force afterwards, or null on failure.
 */
export const SaveGeneralSettings = async (
    changes: Partial<Omit<GeneralSettings, "defaults">>,
    territoryId: number | null = null
): Promise<GeneralSettings | null> => {
    try {
        const response = await api.put<GeneralSettings>("/api/Settings/general", changes, {
            params: { territoryId: territoryId ?? undefined },
        });
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};

/**
 * Saves the receipt email's subject and wording. Empty values go back to the defaults (for a
 * territory, the company's wording).
 * @param subject The subject line.
 * @param body The wording.
 * @param territoryId The territory; null for the company-wide wording.
 * @returns The settings as saved, or null on failure.
 */
export const SaveReceiptEmailSettings = async (
    subject: string,
    body: string,
    territoryId: number | null = null
): Promise<ReceiptEmailSettings | null> => {
    try {
        const response = await api.put<ReceiptEmailSettings>(
            "/api/Settings/receipt-email",
            { subject, body },
            { params: { territoryId: territoryId ?? undefined } }
        );
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};
