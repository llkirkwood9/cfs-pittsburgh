import { useState } from "react";
import { CatalogImportConfirmWord, ParseCatalogFile } from "../Lib/CatalogImport";
import type { CatalogFile, CatalogImportMode, CatalogImportResult } from "../Models/CatalogFile";
import { ImportCatalog } from "../Services/CatalogServices";

/**
 * Restoring a catalog file: the file read in, the way to restore it, the confirmation, and the
 * result.
 * @param onClose Closes the restore.
 * @param onRestored Called on closing after a restore, so the catalog can reload.
 * @returns The state and handlers.
 */
export const useCatalogImport = (onClose: () => void, onRestored: () => void) => {
    const [file, setFile] = useState<CatalogFile | null>(null);
    const [fileName, setFileName] = useState<string>("");
    const [fileProblem, setFileProblem] = useState<string | null>(null);
    const [mode, setMode] = useState<CatalogImportMode>("update");
    const [typed, setTyped] = useState<string>("");
    const [busy, setBusy] = useState<boolean>(false);
    const [result, setResult] = useState<CatalogImportResult | null>(null);

    /**
     * Takes the file picked.
     * @param name Its name; blank when the pick was cleared.
     * @param text Its contents, or null when the pick was cleared.
     */
    const readFile = (name: string, text: string | null) => {
        setFileName(name);
        const read = text === null ? { file: null, problem: null } : ParseCatalogFile(text);
        setFile(read.file);
        setFileProblem(read.problem);
    };

    const locked =
        !file ||
        busy ||
        (mode === "replace" && typed.trim().toUpperCase() !== CatalogImportConfirmWord);

    const restore = async () => {
        if (!file || locked) return;
        setBusy(true);
        const done = await ImportCatalog(file, mode);
        setBusy(false);
        if (!done) return;
        setResult(done);
    };

    // Reloading the catalog swaps the page for its skeleton, so wait until the result is read.
    const finish = () => {
        onClose();
        onRestored();
    };

    return {
        file,
        fileName,
        fileProblem,
        readFile,
        mode,
        setMode,
        typed,
        setTyped,
        locked,
        busy,
        restore,
        result,
        finish,
    };
};
