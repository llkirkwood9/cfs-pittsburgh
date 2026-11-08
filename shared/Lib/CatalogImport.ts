import type { CatalogFile, CatalogImportMode } from "../Models/CatalogFile";

/** What has to be typed before the catalog is cleared and replaced. */
export const CatalogImportConfirmWord = "REPLACE";

/** The two ways to restore a catalog file, in the order they are offered. */
export const CatalogImportModes: { mode: CatalogImportMode; title: string; text: string }[] = [
    {
        mode: "update",
        title: "Update the catalog from this file",
        text: "Products in the file that are already in the catalog (same territory, brand and name) are changed to match it - sizes, prices, sales, selections, bundles and delivery. Anything new is added, each in the territory with the same name (or this territory, when the file names none that's here), and financing options are matched by territory and name. Products, delivery options and financing options that aren't in the file are left as they are, and stock counts are kept.",
    },
    {
        mode: "replace",
        title: "Clear the catalog and replace it",
        text: "Every product and delivery option, in every territory's catalog, is deleted for good - including ones that have been sold - with their stock counts and inventory history, and so are the financing options when the file has them. Then the catalog is rebuilt from the file. Past sales sheets still print exactly as they were sold.",
    },
];

/**
 * Reads a catalog file made with Export catalog.
 * @param text The file's contents.
 * @returns The file, or why it can't be used.
 */
export const ParseCatalogFile = (
    text: string
): { file: CatalogFile; problem: null } | { file: null; problem: string } => {
    try {
        const parsed = JSON.parse(text) as CatalogFile;
        if (parsed?.format !== "cfs-catalog")
            return {
                file: null,
                problem: "This isn't a catalog file. Choose a file made with Export catalog.",
            };
        return { file: parsed, problem: null };
    } catch {
        return {
            file: null,
            problem: "This file couldn't be read. Choose a file made with Export catalog.",
        };
    }
};

const Count = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * What a catalog file holds, e.g. "12 products, 3 delivery options and 2 financing options,
 * exported 9/21/2026, 2:14:00 PM."
 * @param file The file.
 * @returns The summary.
 */
export const CatalogFileSummary = (file: CatalogFile): string => {
    const delivery = Count(
        file.deliveryOptions?.length ?? 0,
        "delivery option",
        "delivery options"
    );
    // A file made before financing options were exported has none, and the current ones are kept.
    const financing = file.financeOptions
        ? ` and ${Count(file.financeOptions.length, "financing option", "financing options")}`
        : " and no financing options (an older file - the current ones are kept)";
    const exported = file.exportedAt
        ? `, exported ${new Date(file.exportedAt).toLocaleString("en-US")}`
        : "";
    return `${Count(file.products?.length ?? 0, "product", "products")}, ${delivery}${financing}${exported}.`;
};
