import { useState } from "react";
import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import Modal from "../Elements/Modal";
import type { CatalogFile, CatalogImportMode, CatalogImportResult } from "../../Models/CatalogFile";
import { ImportCatalog } from "../../Services/CatalogServices";

type Props = {
    onClose: () => void;
    /** Called on closing after a restore, so the catalog can reload. */
    onRestored: () => void;
};

const CONFIRM_WORD = "REPLACE";

/**
 * Restores a catalog file made with Export catalog (system admins only): either bringing matching
 * products in line with the file and adding the rest, or clearing the catalog and rebuilding it
 * from the file.
 */
const ImportCatalogModal = ({ onClose, onRestored }: Props) => {
    const [file, setFile] = useState<CatalogFile | null>(null);
    const [fileName, setFileName] = useState<string>("");
    const [fileProblem, setFileProblem] = useState<string | null>(null);
    const [mode, setMode] = useState<CatalogImportMode>("update");
    const [typed, setTyped] = useState<string>("");
    const [busy, setBusy] = useState<boolean>(false);
    const [result, setResult] = useState<CatalogImportResult | null>(null);

    const pick = async (picked: File | undefined) => {
        setFile(null);
        setFileProblem(null);
        setFileName(picked?.name ?? "");
        if (!picked) return;

        try {
            const parsed = JSON.parse(await picked.text()) as CatalogFile;
            if (parsed?.format !== "cfs-catalog") {
                setFileProblem(
                    "This isn't a catalog file. Choose a file made with Export catalog."
                );
                return;
            }
            setFile(parsed);
        } catch {
            setFileProblem("This file couldn't be read. Choose a file made with Export catalog.");
        }
    };

    const locked =
        !file || busy || (mode === "replace" && typed.trim().toUpperCase() !== CONFIRM_WORD);

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

    const products = file?.products?.length ?? 0;
    const deliveryOptions = file?.deliveryOptions?.length ?? 0;
    // Null for a file made before financing options were exported.
    const financeOptions = file?.financeOptions ? file.financeOptions.length : null;
    const exported = file?.exportedAt ? new Date(file.exportedAt).toLocaleString("en-US") : null;

    if (result) {
        return (
            <Modal
                title="Catalog restored"
                onClose={finish}
                footer={<Button text="Done" icon="fa-solid fa-check" onClick={finish} />}
            >
                <ul className="space-y-1 text-base">
                    {result.productsRemoved +
                        result.deliveryOptionsRemoved +
                        result.financeOptionsRemoved >
                        0 && (
                        <li>
                            Cleared {result.productsRemoved} products,{" "}
                            {result.deliveryOptionsRemoved} delivery options and{" "}
                            {result.financeOptionsRemoved} financing options.
                        </li>
                    )}
                    <li>
                        Products: {result.productsAdded} added
                        {result.productsUpdated > 0 && `, ${result.productsUpdated} updated`}.
                    </li>
                    <li>
                        Delivery options: {result.deliveryOptionsAdded} added
                        {result.deliveryOptionsUpdated > 0 &&
                            `, ${result.deliveryOptionsUpdated} updated`}
                        .
                    </li>
                    {result.financeOptionsAdded + result.financeOptionsUpdated > 0 && (
                        <li>
                            Financing options: {result.financeOptionsAdded} added
                            {result.financeOptionsUpdated > 0 &&
                                `, ${result.financeOptionsUpdated} updated`}
                            .
                        </li>
                    )}
                </ul>
                {result.warnings.length > 0 && (
                    <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                        <p className="mb-1 font-semibold">
                            <Icon icon="fa-solid fa-triangle-exclamation" />{" "}
                            {result.warnings.length === 1
                                ? "One thing couldn't be brought in:"
                                : `${result.warnings.length} things couldn't be brought in:`}
                        </p>
                        <ul className="list-disc space-y-1 pl-5">
                            {result.warnings.map((w) => (
                                <li key={w}>{w}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </Modal>
        );
    }

    const choice = (value: CatalogImportMode, title: string, text: string) => (
        <label
            className={`flex cursor-pointer gap-3 rounded-xl border-2 p-3 ${
                mode === value
                    ? value === "replace"
                        ? "border-red-600 bg-red-50 dark:border-red-500 dark:bg-red-950/30"
                        : "border-sky-600 bg-sky-50 dark:border-sky-500 dark:bg-sky-950/30"
                    : "border-zinc-200 dark:border-zinc-700"
            }`}
        >
            <input
                type="radio"
                name="catalog-import-mode"
                checked={mode === value}
                onChange={() => setMode(value)}
                className="mt-1 h-5 w-5 shrink-0 accent-sky-600"
            />
            <span>
                <span className="block font-semibold">{title}</span>
                <span className="block text-sm text-zinc-600 dark:text-zinc-300">{text}</span>
            </span>
        </label>
    );

    return (
        <Modal
            title="Restore catalog"
            onClose={onClose}
            footer={
                <>
                    <Button
                        text="Cancel"
                        onClick={onClose}
                        className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                    />
                    <Button
                        text={mode === "replace" ? "Clear and restore" : "Restore"}
                        icon="fa-solid fa-file-import"
                        onClick={restore}
                        disabled={locked}
                        loading={busy}
                        className={
                            mode === "replace"
                                ? "bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700"
                                : ""
                        }
                    />
                </>
            }
        >
            <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    Catalog file
                </span>
                <input
                    type="file"
                    accept=".json,application/json"
                    aria-label="Catalog file"
                    onChange={(e) => pick(e.target.files?.[0])}
                    className="min-h-[48px] rounded-xl border border-zinc-300 bg-white p-2 text-base
                        file:mr-3 file:rounded-lg file:border-0 file:bg-sky-700 file:px-3 file:py-2 file:font-semibold file:text-white
                        dark:border-zinc-600 dark:bg-zinc-800"
                />
            </label>
            {fileProblem && (
                <p className="mt-2 text-sm font-semibold text-red-700 dark:text-red-400">
                    {fileProblem}
                </p>
            )}
            {file && (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                    {fileName}: {products} {products === 1 ? "product" : "products"},{" "}
                    {deliveryOptions} delivery {deliveryOptions === 1 ? "option" : "options"}
                    {financeOptions === null
                        ? " and no financing options (an older file - the current ones are kept)"
                        : ` and ${financeOptions} financing ${financeOptions === 1 ? "option" : "options"}`}
                    {exported ? `, exported ${exported}` : ""}.
                </p>
            )}

            <div className="mt-4 space-y-2">
                {choice(
                    "update",
                    "Update the catalog from this file",
                    "Products in the file that are already in the catalog (same brand and name) are changed to match it - sizes, prices, sales, selections, bundles and delivery. Anything new is added, and financing options are matched by name. Products, delivery options and financing options that aren't in the file are left as they are, and stock counts are kept."
                )}
                {choice(
                    "replace",
                    "Clear the catalog and replace it",
                    "Every product and delivery option is deleted for good - including ones that have been sold - with their stock counts and inventory history, and so are the financing options when the file has them. Then the catalog is rebuilt from the file. Past sales sheets still print exactly as they were sold."
                )}
            </div>

            {mode === "replace" && (
                <label className="mt-4 flex flex-col gap-1">
                    <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        Type{" "}
                        <span className="font-bold text-red-700 dark:text-red-400">
                            {CONFIRM_WORD}
                        </span>{" "}
                        to confirm
                    </span>
                    <input
                        value={typed}
                        onChange={(e) => setTyped(e.target.value)}
                        autoCapitalize="characters"
                        autoCorrect="off"
                        aria-label={`Type ${CONFIRM_WORD} to confirm`}
                        className="min-h-[48px] rounded-xl border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-hidden
                            focus:border-red-600 focus:ring-2 focus:ring-red-600/30 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                </label>
            )}
        </Modal>
    );
};

export default ImportCatalogModal;
