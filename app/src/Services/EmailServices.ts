import api from "../Lib/api";
import { HandleAxiosError } from "../Lib/ErrorHandler";

/** Whether the server can send email, and the address it sends from. */
export type EmailStatus = {
    configured: boolean;
    from?: string | null;
};

/** A PDF made on the device: the file it was written to. */
export type PdfFile = {
    uri: string;
};

/** Posted as a form, because it carries the PDF. */
const SendForm = async (url: string, pdf: PdfFile, to: string, message?: string) => {
    const form = new FormData();
    form.append("to", to);
    if (message) form.append("message", message);
    // React Native uploads a file from its uri; the shape isn't in the DOM FormData types.
    form.append("pdf", {
        uri: pdf.uri,
        name: "sheets.pdf",
        type: "application/pdf",
    } as unknown as Blob);
    // Overrides the instance's JSON default; the multipart boundary is filled in for the request.
    const response = await api.post<{ sentTo: string[] }>(url, form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
    });
    return response.data.sentTo;
};

//*************************************//
//*********** POST METHODS ************//
//*************************************//

/**
 * Emails the customer their receipt as a PDF, with a thank-you note.
 * @param orderId The order.
 * @param to Comma-separated addresses; the customer's own address when left empty.
 * @param pdf The receipt, built from the sheet on screen.
 * @returns The addresses it went to, or null on failure.
 */
export const EmailReceipt = async (
    orderId: number,
    to: string,
    pdf: PdfFile
): Promise<string[] | null> => {
    try {
        return await SendForm(`/api/Email/order/${orderId}/receipt`, pdf, to);
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};

/**
 * Emails an event's sheets as a single PDF.
 * @param eventId The event.
 * @param to Comma-separated addresses.
 * @param message Optional note shown at the top.
 * @param pdf The stat sheet, sales sheets and inventory sheet, built from the page.
 * @returns The addresses it went to, or null on failure.
 */
export const EmailEventReport = async (
    eventId: number,
    to: string,
    message: string,
    pdf: PdfFile
): Promise<string[] | null> => {
    try {
        return await SendForm(`/api/Email/event/${eventId}/report`, pdf, to, message);
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
        // A quiet failure: the email button simply says email isn't available.
        return { configured: false };
    }
};
