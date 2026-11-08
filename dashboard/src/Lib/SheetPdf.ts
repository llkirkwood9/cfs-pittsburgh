import type { SheetDetail, SheetPdfRenderer } from "@shared/Lib/SheetPdf";
import { Toast } from "./Toast";

/** US Letter, in inches, with the same margin the printed sheets use. */
const PAGE_W = 8.5;
const PAGE_H = 11;
const MARGIN = 0.35;

/** The width every sheet is laid out at while it is captured, whatever the screen size. */
const SHEET_WIDTH = "8in";

/**
 * The rules of every linked stylesheet the page has already loaded, keyed by its address.
 *
 * html2canvas draws a copy of the page in a hidden frame, and that copy fetches linked stylesheets
 * all over again. On a slow connection - a Raspberry Pi over Wi-Fi - it is drawn before they
 * arrive, and the sheet comes out as plain text with no table borders. Handing the copy the rules
 * the page already has means it never waits on the network.
 * @returns Stylesheet address to its CSS. A sheet the browser won't let us read is left out, and
 * the copy keeps fetching that one itself.
 */
const LoadedStylesheets = (): Map<string, string> => {
    const sheets = new Map<string, string>();
    for (const sheet of Array.from(document.styleSheets)) {
        if (!(sheet.ownerNode instanceof HTMLLinkElement) || !sheet.href) continue;
        try {
            sheets.set(
                sheet.href,
                Array.from(sheet.cssRules)
                    .map((rule) => rule.cssText)
                    .join("\n")
            );
        } catch {
            // Another site's stylesheet: its rules can't be read from here.
        }
    }
    return sheets;
};

/**
 * Swaps the copy's links to the stylesheets in `css` for the same rules written inline.
 * @param doc The copied document.
 * @param css From LoadedStylesheets.
 */
const InlineStylesheets = (doc: Document, css: Map<string, string>) => {
    doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]').forEach((link) => {
        const rules = css.get(link.href);
        if (rules === undefined) return;
        const style = doc.createElement("style");
        style.textContent = rules;
        link.replaceWith(style);
    });
};

/**
 * Turns the sheets on screen into a PDF, one sheet per Letter page, so an emailed copy looks
 * exactly like the printed one. Each sheet is laid out at paper width while it is captured, so a
 * PDF built on a phone matches one built on a laptop. A sheet taller than a page is scaled down
 * to fit, as it is when printed.
 * @param sheets The sheet elements, in page order.
 * @param detail How sharp to capture.
 * @param onProgress Called before each page with its number and the total.
 * @param title The PDF's title, which a print dialog offers as the file name.
 * @returns The PDF.
 */
const BuildSheetsPdf = async (
    sheets: HTMLElement[],
    detail: SheetDetail,
    onProgress?: (page: number, total: number) => void,
    title?: string
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
    if (title) pdf.setProperties({ title });
    const css = LoadedStylesheets();
    const boxW = PAGE_W - MARGIN * 2;
    const boxH = PAGE_H - MARGIN * 2;

    for (let i = 0; i < sheets.length; i++) {
        onProgress?.(i + 1, sheets.length);

        const canvas = await html2canvas(sheets[i], {
            scale: detail.scale,
            backgroundColor: "#ffffff",
            logging: false,
            // A desktop-sized window, so nothing in the copy switches to its phone layout.
            windowWidth: 1280,
            onclone: (doc, sheet) => {
                InlineStylesheets(doc, css);
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
            canvas.toDataURL("image/jpeg", detail.quality),
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
 * The sheets inside a container, in the order they appear.
 * @param root The element holding the sheets.
 * @returns The sheet elements.
 */
export const FindSheets = (root: HTMLElement | null): HTMLElement[] =>
    root ? Array.from(root.querySelectorAll<HTMLElement>(".print-sheet")) : [];

/**
 * Whether this browser can't print a PDF from inside the page: tablets and phones (an iPad says
 * it is a Mac, but a Mac has no touch screen), and Safari, which prints an embedded PDF blank.
 */
const OpensPdfInTab = (): boolean =>
    /iPad|iPhone|iPod|Android/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ||
    /^((?!chrome|chromium|android|edg).)*safari/i.test(navigator.userAgent);

/** The hidden frame the last PDF was printed from, cleared when the next one prints. */
let printFrame: HTMLIFrameElement | null = null;

/**
 * How the dashboard makes and prints the sheets' PDF. A desktop browser prints from a hidden
 * frame, straight to its print dialog; a tablet or phone - whose browsers can't print a PDF from
 * inside the page - opens the PDF in a new tab, to print or share from there. That tab is opened
 * while the tap still counts, or the browser blocks it as a pop-up.
 */
export const sheetPdf: SheetPdfRenderer<HTMLElement, Blob, Window | null> = {
    build: BuildSheetsPdf,
    sizeOf: (pdf) => pdf.size,
    toUpload: (pdf) => pdf,
    tooLargeAdvice: "Use Print / Save PDF and share the file another way.",
    startPrint: (title) => {
        const tab = OpensPdfInTab() ? window.open("", "_blank") : null;
        if (tab) {
            tab.document.title = title;
            tab.document.body.innerHTML =
                '<p style="font:18px system-ui,sans-serif;padding:2em;color:#3f3f46">Making the PDF to print...</p>';
        }
        return tab;
    },
    abandonPrint: (tab) => tab?.close(),
    print: (pdf, title, tab) => {
        const url = URL.createObjectURL(pdf);

        if (OpensPdfInTab()) {
            if (tab) {
                tab.location.href = url;
            } else {
                // The pop-up was blocked: save the file instead.
                const link = document.createElement("a");
                link.href = url;
                link.download = `${title}.pdf`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                Toast.Info("The PDF was saved to this device. Open it to print.");
            }
            return;
        }

        printFrame?.remove();
        const frame = document.createElement("iframe");
        frame.title = title;
        frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
        frame.onload = () => {
            // A moment for the PDF viewer inside the frame to finish drawing the first page.
            setTimeout(() => {
                try {
                    frame.contentWindow?.focus();
                    frame.contentWindow?.print();
                } catch {
                    window.open(url, "_blank");
                }
            }, 250);
        };
        frame.src = url;
        document.body.appendChild(frame);
        printFrame = frame;
    },
};
