import api from "../Lib/api";
import { HandleAxiosError } from "../Lib/ErrorHandler";
import type { CatalogFile, CatalogImportMode, CatalogImportResult } from "../Models/CatalogFile";

//************************************//
//*********** GET METHODS ************//
//************************************//

/**
 * The whole catalog as a file (owners only).
 * @returns The catalog file, or null on failure.
 */
export const ExportCatalog = async (): Promise<CatalogFile | null> => {
    try {
        const response = await api.get<CatalogFile>("/api/Catalog/export");
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};

//*************************************//
//*********** POST METHODS ************//
//*************************************//

/**
 * Restores a catalog file (owners only).
 * @param catalog The file's contents.
 * @param mode "update" to update matching items and add the rest, or "replace" to clear the
 * catalog first.
 * @returns What changed, or null on failure (nothing is changed then).
 */
export const ImportCatalog = async (
    catalog: CatalogFile,
    mode: CatalogImportMode
): Promise<CatalogImportResult | null> => {
    try {
        const response = await api.post<CatalogImportResult>("/api/Catalog/import", {
            mode,
            catalog,
        });
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};
