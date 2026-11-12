import { isAxiosError } from "axios";
import { sheetPdf, Toast } from "@host";
import { HandleAxiosError } from "./ErrorHandler";
import { StartPageUpload, UploadPage } from "../Services/EmailServices";
import type { FileUpload } from "../Services/EmailServices";

/** A failure a host can explain: its message is shown to the user as it is. */
export class SheetPdfError extends Error {}

/**
 * What to tell the user when the PDF couldn't be made.
 * @param error What the host threw.
 * @param otherwise The message for any other failure.
 * @returns The message.
 */
const FailureMessage = (error: unknown, otherwise: string): string =>
    error instanceof SheetPdfError ? error.message : otherwise;

/** How sharp each page is captured. */
export type SheetDetail = {
    /** Pixels per CSS pixel when capturing; 1 is about 96 dpi on paper. A host may ignore it. */
    scale: number;
    /** JPEG quality for each page. */
    quality: number;
};

/** One sheet's picture, ready to upload. */
export type SheetPicture = {
    /** The picture, as a JPEG. */
    file: FileUpload;
    /** Its size in bytes. */
    bytes: number;
};

/**
 * What each host does to turn the sheets on its screen into pictures - one at a time to email, or
 * all in a PDF to print - and to print one. The shared code picks how sharp, keeps an email small
 * enough to send, and reports failures.
 */
export type SheetPdfRenderer<S, P, H = void> = {
    /**
     * Builds the PDF, one sheet per Letter page.
     * @param sheets The sheets, in page order.
     * @param detail How sharp to capture.
     * @param onProgress Called before each page with its number and the total.
     * @param title The PDF's title, which a print dialog offers as the file name.
     */
    build: (
        sheets: S[],
        detail: SheetDetail,
        onProgress?: (page: number, total: number) => void,
        title?: string
    ) => Promise<P>;
    /**
     * Takes one sheet's picture, as build would put it on its page.
     * @param sheet The sheet.
     * @param detail How sharp to capture.
     */
    capture: (sheet: S, detail: SheetDetail) => Promise<SheetPicture>;
    /**
     * Called straight from the tap, before the PDF is made - a browser only opens a new tab then.
     * @returns Whatever print needs later.
     */
    startPrint?: (title: string) => H;
    /** Prints the PDF. */
    print: (pdf: P, title: string, started: H | undefined) => Promise<void> | void;
    /** Undoes startPrint when the PDF couldn't be made. */
    abandonPrint?: (started: H | undefined) => void;
};

/** A sheet on this host's screen, to be captured. */
export type Sheet = Parameters<typeof sheetPdf.build>[0][number];

/**
 * How sharp each page is captured, from sharpest to smallest file. A single receipt gets close to
 * print quality; a big event's stack steps down so the whole PDF still fits in an email. Each
 * entry applies up to its page count.
 */
const DETAIL: { upTo: number; detail: SheetDetail }[] = [
    { upTo: 1, detail: { scale: 3, quality: 1 } },
    { upTo: 3, detail: { scale: 2.5, quality: 0.92 } },
    { upTo: 10, detail: { scale: 2, quality: 0.9 } },
    { upTo: 30, detail: { scale: 1.75, quality: 0.86 } },
    { upTo: Infinity, detail: { scale: 1.5, quality: 0.82 } },
];

/**
 * Where in DETAIL a PDF of this many pages starts.
 * @param pages The page count.
 * @returns The index.
 */
const DetailIndexFor = (pages: number): number => DETAIL.findIndex((d) => pages <= d.upTo);

/**
 * The largest PDF the server will email (most mail services refuse a message over about 25 MB,
 * and an attachment grows by a third when it is encoded). Matches the API's limit; the pictures
 * add up to almost exactly the PDF's size.
 */
const MAX_BYTES = 18 * 1024 * 1024;

/** How many pages upload at once while the next ones are made. */
const UPLOADS_AT_ONCE = 2;

/** How long to wait before each further try at a page whose upload failed for a passing reason. */
const RETRY_DELAYS = [1000, 2000, 4000, 8000];

const TOO_LARGE =
    "These sheets make a PDF too large to email. Print them, or save them as a PDF and share it another way.";

const CONNECTION_DROPPED =
    "The sheets couldn't be sent - the connection kept dropping. Try again where the signal is better.";

/**
 * Waits.
 * @param ms How long.
 */
const Wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Whether a failed upload may work if sent again: no reply at all (the connection dropped or
 * timed out), the server was busy, or it failed for its own reasons.
 * @param error What the upload threw.
 * @returns True when worth another try.
 */
const WorthRetrying = (error: unknown): boolean =>
    isAxiosError(error) &&
    (!error.response || error.response.status >= 500 || error.response.status === 429);

/**
 * Uploads one page, trying again with growing pauses while the connection keeps failing.
 * @param uploadId The upload.
 * @param index The page, from 0.
 * @param picture The page.
 */
const UploadWithRetries = async (uploadId: string, index: number, picture: SheetPicture) => {
    for (let attempt = 0; ; attempt++) {
        try {
            return await UploadPage(uploadId, index, picture.file);
        } catch (error) {
            if (attempt >= RETRY_DELAYS.length || !WorthRetrying(error)) throw error;
            await Wait(RETRY_DELAYS[attempt]);
        }
    }
};

/**
 * Takes each sheet's picture and uploads it while the next is taken, so the upload is done almost
 * as soon as the last picture is. A page that fails is sent again; a stack that would come to more
 * than an email can carry is started again, less sharp, as soon as that is clear.
 * @param sheets The sheets, in page order.
 * @param progress Told how far it has got.
 * @returns The upload's id; null when it failed and the user has been told why.
 */
const UploadSheets = async (
    sheets: Sheet[],
    progress: (status: string) => void
): Promise<string | null> => {
    const total = sheets.length;
    const report = (sent: number) =>
        progress(
            total === 1 ? "Sending the sheet..." : `Sending the sheets: ${sent} of ${total}...`
        );

    for (let level = DetailIndexFor(total); level < DETAIL.length; level++) {
        const uploadId = await StartPageUpload(total);
        if (!uploadId) return null;

        const uploading = new Set<Promise<void>>();
        let sent = 0;
        let bytes = 0;
        let failure: unknown = null;
        let smaller = false;
        report(0);

        for (let i = 0; i < total && failure === null; i++) {
            const picture = await sheetPdf.capture(sheets[i], DETAIL[level].detail);
            bytes += picture.bytes;
            // Judged from the pages so far, so a stack too big is caught early, not at the end.
            if ((bytes / (i + 1)) * total > MAX_BYTES && level < DETAIL.length - 1) {
                smaller = true;
                break;
            }
            if (bytes > MAX_BYTES) {
                Toast.Error(TOO_LARGE);
                return null;
            }

            const upload: Promise<void> = UploadWithRetries(uploadId, i, picture)
                .then(() => report(++sent))
                .catch((error: unknown) => {
                    failure ??= error;
                })
                .finally(() => uploading.delete(upload));
            uploading.add(upload);
            if (uploading.size >= UPLOADS_AT_ONCE) await Promise.race(uploading);
        }
        // The pages already on their way finish either way.
        await Promise.all(uploading);
        if (smaller) continue;

        if (failure !== null) {
            if (WorthRetrying(failure)) Toast.Error(CONNECTION_DROPPED);
            else HandleAxiosError(failure);
            return null;
        }
        return uploadId;
    }
    Toast.Error(TOO_LARGE);
    return null;
};

/**
 * An upload the server still holds after a send it couldn't deliver, by what was being sent, so
 * trying again needn't upload the pages again.
 */
const keptUploads = new Map<string, { uploadId: string; pages: number }>();

/**
 * Emails the sheets: their pictures are uploaded page by page as they are made, and the server
 * makes them into one PDF and sends it. A failure is reported to the user rather than thrown.
 * @param key What is being sent, e.g. "event:12"; a failed send's pages are kept under it.
 * @param sheets The sheets, in page order.
 * @param progress Told what it is doing.
 * @param send Sends the uploaded pages; returns null when it failed and has said why.
 * @returns What send returned, or null when anything failed.
 */
export const EmailSheets = async <T>(
    key: string,
    sheets: Sheet[],
    progress: (status: string) => void,
    send: (uploadId: string) => Promise<T | null>
): Promise<T | null> => {
    if (sheets.length === 0) {
        Toast.Warning("There are no sheets to send.");
        return null;
    }

    // Used once: if the second try fails too, the next starts afresh.
    const kept = keptUploads.get(key);
    keptUploads.delete(key);
    let uploadId = kept?.pages === sheets.length ? kept.uploadId : null;

    if (!uploadId) {
        try {
            uploadId = await UploadSheets(sheets, progress);
        } catch (error) {
            console.error("Taking the sheets' pictures failed", error);
            Toast.Error(FailureMessage(error, "The sheets couldn't be made ready. Try again."));
            return null;
        }
        if (!uploadId) return null;
    }

    progress("Emailing...");
    const result = await send(uploadId);
    if (result === null && !kept) keptUploads.set(key, { uploadId, pages: sheets.length });
    return result;
};

/**
 * Prints the sheets from the same picture-per-page PDF that email sends, so the paper looks the
 * same from every device. Call it straight from the tap, before awaiting anything else.
 * @param sheets The sheets, in page order.
 * @param title The PDF's title, which a print dialog offers as the file name.
 * @param onProgress Called before each page with its number and the total.
 * @returns Whether the PDF was made.
 */
export const PrintSheetsPdf = async (
    sheets: Sheet[],
    title: string,
    onProgress?: (page: number, total: number) => void
): Promise<boolean> => {
    if (sheets.length === 0) {
        Toast.Warning("There are no sheets to print.");
        return false;
    }

    const started = sheetPdf.startPrint?.(title);
    let pdf: Awaited<ReturnType<typeof sheetPdf.build>>;
    try {
        pdf = await sheetPdf.build(
            sheets,
            DETAIL[DetailIndexFor(sheets.length)].detail,
            onProgress,
            title
        );
    } catch (error) {
        console.error("Building the PDF failed", error);
        sheetPdf.abandonPrint?.(started);
        Toast.Error(FailureMessage(error, "The PDF couldn't be made. Try again."));
        return false;
    }

    await sheetPdf.print(pdf, title, started);
    return true;
};
