import { sheetPdf, Toast } from "@host";
import type { PdfUpload } from "../Services/EmailServices";

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

/**
 * What each host does to turn the sheets on its screen into a picture-per-page PDF, and to print
 * one. The shared code picks how sharp, keeps the PDF small enough to email, and reports failures.
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
    /** The PDF's size in bytes. */
    sizeOf: (pdf: P) => number;
    /** The PDF as an upload for the email services. */
    toUpload: (pdf: P) => PdfUpload;
    /** What to do instead when the PDF is too large to email. */
    tooLargeAdvice: string;
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
 * and an attachment grows by a third when it is encoded). Matches the API's limit.
 */
const MAX_BYTES = 18 * 1024 * 1024;

/**
 * Makes the PDF for an email: a failure is reported to the user rather than thrown, and a PDF too
 * big to email is made again, less sharp, until it fits.
 * @param sheets The sheets, in page order.
 * @param onProgress Called before each page with its number and the total.
 * @returns The PDF as an upload, or null when it couldn't be made.
 */
export const TryBuildSheetsPdf = async (
    sheets: Sheet[],
    onProgress?: (page: number, total: number) => void
): Promise<PdfUpload | null> => {
    if (sheets.length === 0) {
        Toast.Warning("There are no sheets to put in the PDF.");
        return null;
    }
    try {
        for (let i = DetailIndexFor(sheets.length); i < DETAIL.length; i++) {
            const pdf = await sheetPdf.build(sheets, DETAIL[i].detail, onProgress);
            if (sheetPdf.sizeOf(pdf) <= MAX_BYTES) return sheetPdf.toUpload(pdf);
        }
        Toast.Error(`These sheets make a PDF too large to email. ${sheetPdf.tooLargeAdvice}`);
        return null;
    } catch (error) {
        console.error("Building the PDF failed", error);
        Toast.Error(
            FailureMessage(error, "The PDF couldn't be made. Try again, or print instead.")
        );
        return null;
    }
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
