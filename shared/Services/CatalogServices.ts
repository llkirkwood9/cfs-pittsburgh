import { client } from "@host";
import { CallApi } from "./CallApi";
import type { CatalogFile, CatalogImportMode, CatalogImportResult } from "../Models/CatalogFile";

//************************************//
//*********** GET METHODS ************//
//************************************//

/**
 * The whole catalog as a file (system admins only).
 * @returns The catalog file, or null on failure.
 */
export const ExportCatalog = async (): Promise<CatalogFile | null> => {
    return CallApi(async () => {
        const response = await client.api.get<CatalogFile>("/api/Catalog/export");
        return response.data;
    }, null);
};

//*************************************//
//*********** POST METHODS ************//
//*************************************//

/**
 * Restores a catalog file (system admins only).
 * @param catalog The file's contents.
 * @param mode "update" to update matching items and add the rest, or "replace" to clear the
 * catalog first.
 * @returns What changed, or null on failure (nothing is changed then).
 */
export const ImportCatalog = async (
    catalog: CatalogFile,
    mode: CatalogImportMode
): Promise<CatalogImportResult | null> => {
    return CallApi(async () => {
        const response = await client.api.post<CatalogImportResult>("/api/Catalog/import", {
            mode,
            catalog,
        });
        return response.data;
    }, null);
};
