import api from "../Lib/api";
import { HandleAxiosError } from "../Lib/ErrorHandler";
import type { ReceiptEmailPreview, ReceiptEmailSettings } from "../Models/ReceiptEmailSettings";

//*************************************//
//*********** POST METHODS ************//
//*************************************//

/**
 * Shows how a receipt email body reads for a sample order, without saving it.
 * @param body The wording to try.
 * @returns The subject and body as they would be sent, or null on failure.
 */
export const PreviewReceiptEmail = async (body: string): Promise<ReceiptEmailPreview | null> => {
    try {
        const response = await api.post<ReceiptEmailPreview>(
            "/api/Settings/receipt-email/preview",
            {
                body,
            }
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
 * Gets the receipt email's wording, its default and the placeholders it can use.
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
 * Saves the receipt email's wording. An empty body goes back to the default.
 * @param body The wording.
 * @returns The settings as saved, or null on failure.
 */
export const SaveReceiptEmailSettings = async (
    body: string
): Promise<ReceiptEmailSettings | null> => {
    try {
        const response = await api.put<ReceiptEmailSettings>("/api/Settings/receipt-email", {
            body,
        });
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};
