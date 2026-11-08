import { ShareTextFile } from "./Files";

/**
 * Hands the CSV to the device's share sheet - Files, Mail, Numbers, Excel, AirDrop.
 * @param filename Name the file is saved as.
 * @param text File contents.
 */
export const DownloadCsv = async (filename: string, text: string): Promise<void> => {
    await ShareTextFile(filename, text, "text/csv", "public.comma-separated-values-text");
};
