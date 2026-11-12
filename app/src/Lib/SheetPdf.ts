import { Directory, File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import type { RefObject } from "react";
import type { View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { BuildImagePdf } from "./ImagePdf";
import type { SheetDetail, SheetPdfRenderer, SheetPicture } from "@shared/Lib/SheetPdf";
import type { FileUpload } from "@shared/Services/EmailServices";

/**
 * The width every sheet is laid out at on screen, whatever the device: 8 inches, as on the
 * dashboard, so a PDF made on a phone matches one made on a tablet.
 */
export const SHEET_WIDTH = 768;

/** A PDF made on the device: the file it was written to. */
export type PdfFile = {
    uri: string;
};

/** A sheet on screen, to be captured. */
export type SheetRef = RefObject<View | null>;

/**
 * Turns the sheets on screen into a PDF, one sheet per Letter page, so an emailed or printed copy
 * looks exactly like the sheet on screen - the same picture-per-page PDF the dashboard makes.
 * Each sheet is captured as a picture and placed on its page as the dashboard places it, inside a
 * 0.35in margin and shrunk to fit when it is taller than the page. The PDF is written directly, so
 * a phone and a tablet make the same one.
 * @param sheets The sheets, in page order.
 * @param detail How sharp to capture; only the JPEG quality applies here.
 * @param onProgress Called before each page with its number and the total.
 * @param title The PDF's title, which the print dialog shows.
 * @returns The PDF file on the device.
 */
const BuildSheetsPdf = async (
    sheets: SheetRef[],
    { quality }: SheetDetail,
    onProgress?: (page: number, total: number) => void,
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

    const name =
        (title ?? "sheets").replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "") || "sheets";
    const file = new File(folder, `${name}.pdf`);
    file.create();
    file.write(BuildImagePdf(pages, title));
    return { uri: file.uri };
};

/**
 * Takes one sheet's picture, to email; the server puts the pictures in a PDF as BuildImagePdf
 * does.
 * @param sheet The sheet on screen.
 * @param detail How sharp to capture; only the JPEG quality applies here.
 * @returns The picture, as a file on the device.
 */
const CaptureSheet = async (sheet: SheetRef, { quality }: SheetDetail): Promise<SheetPicture> => {
    const view = sheet.current;
    if (!view) throw new Error("The sheet isn't on screen.");
    const uri = await captureRef(view, { format: "jpg", quality, result: "tmpfile" });
    // Let the screen repaint between pages so a long report doesn't freeze the tablet.
    await new Promise((resolve) => setTimeout(resolve, 0));
    return {
        // React Native's FormData uploads a file from its uri; that shape isn't in the DOM
        // FormData types the shared email service is written against.
        file: { uri, name: "page.jpg", type: "image/jpeg" } as unknown as FileUpload,
        bytes: new File(uri).size,
    };
};

/**
 * How the app makes and prints the sheets' PDF: written to the device, printed through the
 * system print dialog (AirPrint on iOS, the print service on Android).
 */
export const sheetPdf: SheetPdfRenderer<SheetRef, PdfFile> = {
    build: BuildSheetsPdf,
    capture: CaptureSheet,
    print: async (pdf) => {
        try {
            await Print.printAsync({ uri: pdf.uri });
        } catch {
            // Closing the print dialog without printing rejects on iOS; nothing to report.
        }
    },
};
