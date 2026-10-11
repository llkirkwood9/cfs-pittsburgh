import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { Toast } from "./Toast";

/**
 * Writes a text file to the app's cache and opens the share sheet for it, where it can be saved to
 * Files, mailed or opened in another app - the app's version of a browser download.
 * @param filename Name the file is shared as.
 * @param text File contents.
 * @param mimeType Its type, e.g. "text/csv".
 * @param uti Its iOS type identifier, e.g. "public.json".
 */
export const ShareTextFile = async (
    filename: string,
    text: string,
    mimeType: string,
    uti: string
): Promise<void> => {
    if (Platform.OS === "web") {
        // The browser test build saves the file as the dashboard does.
        const blob = new Blob([text], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
        return;
    }

    try {
        const file = new File(Paths.cache, filename);
        if (file.exists) file.delete();
        file.create();
        file.write(text);
        await ShareFile(file.uri, mimeType, uti, filename);
    } catch (error) {
        console.error("Sharing the file failed", error);
        Toast.Error("The file couldn't be saved. Try again.");
    }
};

/**
 * Opens the share sheet for a file already on the device.
 * @param uri The file.
 * @param mimeType Its type, e.g. "application/pdf".
 * @param uti Its iOS type identifier, e.g. "com.adobe.pdf".
 * @param title What the sheet is titled on Android.
 */
export const ShareFile = async (
    uri: string,
    mimeType: string,
    uti: string,
    title: string
): Promise<void> => {
    if (!(await Sharing.isAvailableAsync())) {
        Toast.Warning("Sharing isn't available on this device.");
        return;
    }
    await Sharing.shareAsync(uri, { mimeType, UTI: uti, dialogTitle: title });
};

/**
 * Lets the user pick a file from Files, iCloud Drive, Google Drive or the device, and reads it as
 * text.
 * @param mimeTypes The kinds of file to offer, e.g. ["application/json"].
 * @returns The file's name and text, or null when nothing was picked.
 */
export const PickTextFile = async (
    mimeTypes: string[]
): Promise<{ name: string; text: string } | null> => {
    const result = await DocumentPicker.getDocumentAsync({
        type: mimeTypes,
        copyToCacheDirectory: true,
        multiple: false,
    });
    if (result.canceled || result.assets.length === 0) return null;

    const asset = result.assets[0];
    if (Platform.OS === "web") {
        const text = asset.file ? await asset.file.text() : await (await fetch(asset.uri)).text();
        return { name: asset.name, text };
    }
    return { name: asset.name, text: await new File(asset.uri).text() };
};
