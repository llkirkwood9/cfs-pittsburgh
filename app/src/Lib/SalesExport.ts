import { ShareTextFile } from "./Files";

/**
 * Hands the CSV to the device's share sheet - Files, Mail, Numbers, Excel, AirDrop.
 * @param filename Name the file is saved as.
 * @param text File contents.
 */
export const DownloadCsv = async (filename: string, text: string): Promise<void> => {
    // The byte-order mark makes Excel read the file as UTF-8 rather than mangling accents.
    const bom = String.fromCharCode(0xfeff);
    await ShareTextFile(filename, bom + text, "text/csv", "public.comma-separated-values-text");
};
