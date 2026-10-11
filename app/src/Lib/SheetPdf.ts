import { File } from "expo-file-system";
import * as Print from "expo-print";
import type { RefObject } from "react";
import type { View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { ShareFile } from "./Files";
import { Toast } from "./Toast";
import type { PdfFile } from "../Services/EmailServices";

/** US Letter, in points, with the same margin the printed sheets use (0.35in). */
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 25;

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
 * Each sheet is captured as a picture, then the pictures are laid out on Letter pages. A sheet
 * taller than a page is scaled down to fit, as it is when printed.
 * @param sheets The sheets, in page order.
 * @param onProgress Called before each page with its number and the total.
 * @param quality JPEG quality; by default, as sharp as this many pages allow.
 * @returns The PDF file on the device.
 */
export const BuildSheetsPdf = async (
    sheets: SheetRef[],
    onProgress?: (page: number, total: number) => void,
    quality: number = QUALITY[QualityIndexFor(sheets.length)].quality
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

    const boxW = PAGE_W - MARGIN * 2;
    const boxH = PAGE_H - MARGIN * 2;
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  @page { size: ${PAGE_W}px ${PAGE_H}px; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .page { width: ${PAGE_W}px; height: ${PAGE_H}px; box-sizing: border-box; padding: ${MARGIN}px;
          display: flex; justify-content: center; align-items: flex-start; page-break-after: always;
          overflow: hidden; }
  .page:last-child { page-break-after: auto; }
  img { max-width: ${boxW}px; max-height: ${boxH}px; width: auto; height: auto; }
</style></head><body>
${pages.map((p) => `<div class="page"><img src="data:image/jpeg;base64,${p}" /></div>`).join("\n")}
</body></html>`;

    const result = await Print.printToFileAsync({
        html,
        width: PAGE_W,
        height: PAGE_H,
        margins: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return { uri: result.uri };
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
            "These sheets make a PDF too large to email. Use Print / Share PDF and send the file another way."
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
 * @returns Whether the PDF was made.
 */
export const PrintSheetsPdf = async (
    sheets: SheetRef[],
    onProgress?: (page: number, total: number) => void
): Promise<boolean> => {
    if (sheets.length === 0) {
        Toast.Warning("There are no sheets to print.");
        return false;
    }

    let pdf: PdfFile;
    try {
        pdf = await BuildSheetsPdf(sheets, onProgress);
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

/**
 * Makes the PDF and opens the share sheet for it - save to Files, AirDrop, Mail, another app.
 * @param sheets The sheets, in page order.
 * @param title The file's name, without .pdf.
 * @param onProgress Called before each page with its number and the total.
 */
export const ShareSheetsPdf = async (
    sheets: SheetRef[],
    title: string,
    onProgress?: (page: number, total: number) => void
): Promise<void> => {
    if (sheets.length === 0) {
        Toast.Warning("There are no sheets to share.");
        return;
    }
    try {
        const pdf = await BuildSheetsPdf(sheets, onProgress);
        // Give the file a readable name before handing it over.
        const named = new File(new File(pdf.uri).parentDirectory, `${title.replace(/[\\/:*?"<>|]/g, "-")}.pdf`);
        if (named.exists) named.delete();
        new File(pdf.uri).move(named);
        await ShareFile(named.uri, "application/pdf", "com.adobe.pdf", title);
    } catch (error) {
        console.error("Sharing the PDF failed", error);
        Toast.Error("The PDF couldn't be made. Try again.");
    }
};
