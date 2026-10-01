import { Toast } from "./Toast";

/** US Letter, in inches, with the same margin the printed sheets use. */
const PAGE_W = 8.5;
const PAGE_H = 11;
const MARGIN = 0.35;

/** The width every sheet is laid out at while it is captured, whatever the screen size. */
const SHEET_WIDTH = "8in";

/** Pixels per CSS pixel when capturing: about 145 dpi on paper, sharp but not huge. */
const SCALE = 1.5;

/** JPEG quality for each page. Sheets are black lines on white, which compress well. */
const QUALITY = 0.78;

/**
 * The largest PDF the server will email (most mail services refuse a message over about 25 MB,
 * and an attachment grows by a third when it is encoded). Matches the API's limit.
 */
const MAX_BYTES = 18 * 1024 * 1024;

/**
 * Turns the sheets on screen into a PDF, one sheet per Letter page, so an emailed copy looks
 * exactly like the printed one. Each sheet is laid out at paper width while it is captured, so a
 * PDF built on a phone matches one built on a laptop. A sheet taller than a page is scaled down
 * to fit, as it is when printed.
 * @param sheets The sheet elements, in page order.
 * @param onProgress Called before each page with its number and the total.
 * @returns The PDF.
 */
export const BuildSheetsPdf = async (
    sheets: HTMLElement[],
    onProgress?: (page: number, total: number) => void
): Promise<Blob> => {
    // Loaded on demand: together they are larger than the rest of the app.
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
    ]);

    const pdf = new jsPDF({
        unit: "in",
        format: "letter",
        orientation: "portrait",
        compress: true,
    });
    const boxW = PAGE_W - MARGIN * 2;
    const boxH = PAGE_H - MARGIN * 2;

    for (let i = 0; i < sheets.length; i++) {
        onProgress?.(i + 1, sheets.length);

        const canvas = await html2canvas(sheets[i], {
            scale: SCALE,
            backgroundColor: "#ffffff",
            logging: false,
            // A desktop-sized window, so nothing in the copy switches to its phone layout.
            windowWidth: 1280,
            onclone: (_doc, sheet) => {
                sheet.style.width = SHEET_WIDTH;
                sheet.style.maxWidth = SHEET_WIDTH;
                sheet.style.margin = "0";
                sheet.style.boxShadow = "none";
            },
        });

        const ratio = canvas.width / canvas.height;
        let w = boxW;
        let h = w / ratio;
        if (h > boxH) {
            h = boxH;
            w = h * ratio;
        }

        if (i > 0) pdf.addPage("letter", "portrait");
        pdf.addImage(
            canvas.toDataURL("image/jpeg", QUALITY),
            "JPEG",
            (PAGE_W - w) / 2,
            MARGIN,
            w,
            h,
            undefined,
            "FAST"
        );

        // Let the screen repaint between pages so a long report doesn't freeze the tablet.
        canvas.width = canvas.height = 0;
        await new Promise((resolve) => setTimeout(resolve, 0));
    }

    return pdf.output("blob");
};

/**
 * BuildSheetsPdf for the email buttons: a failure is reported to the user rather than thrown.
 * @param sheets The sheet elements, in page order.
 * @param onProgress Called before each page with its number and the total.
 * @returns The PDF, or null when it couldn't be made.
 */
export const TryBuildSheetsPdf = async (
    sheets: HTMLElement[],
    onProgress?: (page: number, total: number) => void
): Promise<Blob | null> => {
    if (sheets.length === 0) {
        Toast.Warning("There are no sheets to put in the PDF.");
        return null;
    }
    try {
        const pdf = await BuildSheetsPdf(sheets, onProgress);
        if (pdf.size > MAX_BYTES) {
            Toast.Error(
                "These sheets make a PDF too large to email. Use Print / Save PDF and share the file another way."
            );
            return null;
        }
        return pdf;
    } catch (error) {
        console.error("Building the PDF failed", error);
        Toast.Error("The PDF couldn't be made. Try again, or print instead.");
        return null;
    }
};

/**
 * The sheets inside a container, in the order they appear.
 * @param root The element holding the sheets.
 * @returns The sheet elements.
 */
export const FindSheets = (root: HTMLElement | null): HTMLElement[] =>
    root ? Array.from(root.querySelectorAll<HTMLElement>(".print-sheet")) : [];
