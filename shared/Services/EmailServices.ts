import { client } from "@host";
import { CallApi } from "./CallApi";

/** Whether the server can send email, and the address it sends from. */
export type EmailStatus = {
    configured: boolean;
    from?: string | null;
};

/**
 * A file to upload: a Blob in the browser; in the app, the file it was written to (see
 * app/src/Lib/SheetPdf.ts), which React Native's FormData uploads from its uri.
 */
export type FileUpload = Blob;

/** Posted as a form, because the server also takes a whole PDF this way from older app builds. */
const SendForm = async (url: string, uploadId: string, to: string, message?: string) => {
    const form = new FormData();
    form.append("to", to);
    if (message) form.append("message", message);
    form.append("uploadId", uploadId);
    // Overrides the instance's JSON default; the browser fills in the multipart boundary.
    const response = await client.api.post<{ sentTo: string[] }>(url, form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
    });
    return response.data.sentTo;
};

//*************************************//
//*********** POST METHODS ************//
//*************************************//

/**
 * Starts uploading sheets one page at a time, to email afterwards.
 * @param pageCount How many pages there will be.
 * @returns The upload's id, or null on failure.
 */
export const StartPageUpload = async (pageCount: number): Promise<string | null> => {
    return CallApi(async () => {
        const response = await client.api.post<{ uploadId: string }>("/api/Email/pages", {
            pageCount,
        });
        return response.data.uploadId;
    }, null);
};

/**
 * Uploads one page's picture. Sending the same page again replaces it. Throws on failure, so the
 * caller can decide whether to try again.
 * @param uploadId From StartPageUpload.
 * @param index The page, from 0.
 * @param page The page as a JPEG.
 */
export const UploadPage = async (uploadId: string, index: number, page: FileUpload) => {
    const form = new FormData();
    form.append("page", page, "page.jpg");
    await client.api.put(`/api/Email/pages/${uploadId}/${index}`, form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000,
    });
};

/**
 * Emails the customer their receipt as a PDF, with a thank-you note.
 * @param orderId The order.
 * @param to Comma-separated addresses; the customer's own address when left empty.
 * @param uploadId The receipt's page, uploaded from the sheet on screen.
 * @returns The addresses it went to, or null on failure.
 */
export const EmailReceipt = async (
    orderId: number,
    to: string,
    uploadId: string
): Promise<string[] | null> => {
    return CallApi(async () => {
        return await SendForm(`/api/Email/order/${orderId}/receipt`, uploadId, to);
    }, null);
};

/**
 * Emails an event's sheets as a single PDF.
 * @param eventId The event.
 * @param to Comma-separated addresses.
 * @param message Optional note shown at the top.
 * @param uploadId The stat sheet, sales sheets and inventory sheet, uploaded from the page.
 * @returns The addresses it went to, or null on failure.
 */
export const EmailEventReport = async (
    eventId: number,
    to: string,
    message: string,
    uploadId: string
): Promise<string[] | null> => {
    return CallApi(async () => {
        return await SendForm(`/api/Email/event/${eventId}/report`, uploadId, to, message);
    }, null);
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
        const response = await client.api.get<EmailStatus>("/api/Email/status");
        return response.data;
    } catch {
        // A quiet failure: the email button simply says email isn't available.
        return { configured: false };
    }
};
