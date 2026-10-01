import api from "../Lib/api";
import { HandleAxiosError } from "../Lib/ErrorHandler";

/** Whether the server can send email, and the address it sends from. */
export type EmailStatus = {
    configured: boolean;
    from?: string | null;
};

//*************************************//
//*********** POST METHODS ************//
//*************************************//

/**
 * Emails the receipt for a completed sale.
 * @param orderId The order.
 * @param to Comma-separated addresses; the customer's own address when left empty.
 * @returns The addresses it went to, or null on failure.
 */
export const EmailReceipt = async (orderId: number, to: string): Promise<string[] | null> => {
    try {
        const response = await api.post<{ sentTo: string[] }>(
            `/api/Email/order/${orderId}/receipt`,
            { to }
        );
        return response.data.sentTo;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};

/**
 * Emails an event's full report, with the sales and inventory attached as spreadsheets.
 * @param eventId The event.
 * @param to Comma-separated addresses.
 * @param message Optional note shown at the top.
 * @returns The addresses it went to, or null on failure.
 */
export const EmailEventReport = async (
    eventId: number,
    to: string,
    message: string
): Promise<string[] | null> => {
    try {
        const response = await api.post<{ sentTo: string[] }>(
            `/api/Email/event/${eventId}/report`,
            {
                to,
                message,
            }
        );
        return response.data.sentTo;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};

//************************************//
//*********** GET METHODS ************//
//************************************//

/**
 * Whether email is set up on the server.
 * @returns The status; treated as not configured when it cannot be read.
 */
export const GetEmailStatus = async (): Promise<EmailStatus> => {
    try {
        const response = await api.get<EmailStatus>("/api/Email/status");
        return response.data;
    } catch {
        // A quiet failure: the email button simply shows as unavailable.
        return { configured: false };
    }
};
