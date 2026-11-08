/**
 * Hands the browser a file to save.
 * @param filename Name the file is saved as.
 * @param text File contents.
 */
export const DownloadCsv = (filename: string, text: string): void => {
    // The byte-order mark makes Excel read the file as UTF-8 rather than mangling accents.
    const blob = new Blob(["﻿", text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
};
