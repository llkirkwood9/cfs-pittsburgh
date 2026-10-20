import { Directory, File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import type { RefObject } from "react";
import type { View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { BuildImagePdf } from "./ImagePdf";
import { Toast } from "./Toast";
import type { PdfFile } from "../Services/EmailServices";

/**
 * The width every sheet is laid out at on screen, whatever the device: 8 inches, as on the
 * dashboard, so a PDF made on a phone matches one made on a tablet.
 */
export const SHEET_WIDTH = 768;

/** JPEG quality for each page, from sharpest to smallest file, as the dashboard steps down. */
const QUALITY: { upTo: number; quality: number }[] = [
    { upTo: 1, quality: 1 },
    { upTo: 3, quality: 0.92 },
    { upTo: 10, quality: 0.9 },
    { upTo: 30, quality: 0.86 },
    { upTo: Infinity, quality: 0.82 },
];

/** Where in QUALITY a PDF of this many pages starts. */
const QualityIndexFor = (pages: number): number => QUALITY.findIndex((q) => pages <= q.upTo);

/**
 * The largest PDF the server will email (most mail services refuse a message over about 25 MB,
 * and an attachment grows by a third when it is encoded). Matches the API's limit.
 */
const MAX_BYTES = 18 * 1024 * 1024;

/** A sheet on screen, to be captured. */
export type SheetRef = RefObject<View | null>;

/**
 * Turns the sheets on screen into a PDF, one sheet per Letter page, so an emailed or printed copy
 * looks exactly like the sheet on screen - the same picture-per-page PDF the dashboard makes.
 * Each sheet is captured as a picture and placed on its page as the dashboard places it, inside a
 * 0.35in margin and shrunk to fit when it is taller than the page. The PDF is written directly, so
 * a phone and a tablet make the same one.
 * @param sheets The sheets, in page order.
 * @param onProgress Called before each page with its number and the total.
 * @param quality JPEG quality; by default, as sharp as this many pages allow.
 * @param title The PDF's title, which the print dialog shows.
 * @returns The PDF file on the device.
 */
export const BuildSheetsPdf = async (
    sheets: SheetRef[],
    onProgress?: (page: number, total: number) => void,
    quality: number = QUALITY[QualityIndexFor(sheets.length)].quality,
    title?: string
): Promise<PdfFile> => {
    const pages: string[] = [];
    for (let i = 0; i < sheets.length; i++) {
        onProgress?.(i + 1, sheets.length);
        const view = sheets[i].current;
        if (!view) continue;
        const base64 = await captureRef(view, { format: "jpg", quality, result: "base64" });
        pages.push(base64);
        // Let the screen repaint between pages so a long report doesn't freeze the tablet.
        await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // One folder of PDFs in the cache, emptied each time so old ones don't pile up.
    const folder = new Directory(Paths.cache, "Sheets");
    if (folder.exists) folder.delete();
    folder.create({ intermediates: true });

    const name = (title ?? "sheets").replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "") || "sheets";
    const file = new File(folder, `${name}.pdf`);
    file.create();
    file.write(BuildImagePdf(pages, title));
    return { uri: file.uri };
};

/**
 * BuildSheetsPdf for the email buttons: a failure is reported to the user rather than thrown, and
 * a PDF too big to email is made again, smaller.
 * @param sheets The sheets, in page order.
 * @param onProgress Called before each page with its number and the total.
 * @returns The PDF, or null when it couldn't be made.
 */
export const TryBuildSheetsPdf = async (
    sheets: SheetRef[],
    onProgress?: (page: number, total: number) => void
): Promise<PdfFile | null> => {
    if (sheets.length === 0) {
        Toast.Warning("There are no sheets to put in the PDF.");
        return null;
    }
    try {
        for (let i = QualityIndexFor(sheets.length); i < QUALITY.length; i++) {
            const pdf = await BuildSheetsPdf(sheets, onProgress, QUALITY[i].quality);
            if (new File(pdf.uri).size <= MAX_BYTES) return pdf;
        }
        Toast.Error(
            "These sheets make a PDF too large to email. Use Print instead - the print screen can also save the PDF."
        );
        return null;
    } catch (error) {
        console.error("Building the PDF failed", error);
        Toast.Error("The PDF couldn't be made. Try again, or print instead.");
        return null;
    }
};

/**
 * Prints the sheets on screen from the same picture-per-page PDF that email sends, so the paper
 * looks the same from every device. Opens the system print dialog (AirPrint on iOS, the print
 * service on Android).
 * @param sheets The sheets, in page order.
 * @param onProgress Called before each page with its number and the total.
 * @param title The PDF's title, which the print dialog shows.
 * @returns Whether the PDF was made.
 */
export const PrintSheetsPdf = async (
    sheets: SheetRef[],
    onProgress?: (page: number, total: number) => void,
    title?: string
): Promise<boolean> => {
    if (sheets.length === 0) {
        Toast.Warning("There are no sheets to print.");
        return false;
    }

    let pdf: PdfFile;
    try {
        pdf = await BuildSheetsPdf(sheets, onProgress, undefined, title);
    } catch (error) {
        console.error("Building the PDF failed", error);
        Toast.Error("The PDF couldn't be made. Try again.");
        return false;
    }

    try {
        await Print.printAsync({ uri: pdf.uri });
    } catch {
        // Closing the print dialog without printing rejects on iOS; nothing to report.
    }
    return true;
};
