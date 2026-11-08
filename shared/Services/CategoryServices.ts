import { client } from "@host";
import { CallApi } from "./CallApi";
import type { Category } from "../Models/Category";

//*************************************//
//*********** POST METHODS ************//
//*************************************//

/**
 * Adds a category at the end of the territory's list.
 * @param category The new category.
 * @returns The created category, or null on failure.
 */
export const AddCategory = async (category: Category): Promise<Category | null> => {
    return CallApi(async () => {
        const response = await client.api.post<Category>("/api/Category/category", category);
        return response.data;
    }, null);
};

//************************************//
//*********** GET METHODS ************//
//************************************//

/**
 * Lists the categories of the territory in view, or of every territory the user works in.
 * @returns Categories in tab order, each territory's together, or null on failure.
 */
export const GetCategories = async (): Promise<Category[] | null> => {
    return CallApi(async () => {
        const response = await client.api.get<Category[]>("/api/Category/categories");
        return response.data;
    }, null);
};

//**************************************//
//*********** PATCH METHODS ************//
//**************************************//

/**
 * Renames a category or changes the stat-sheet column its items count in.
 * @param category The fields to change, including the id.
 * @returns The updated category, or null on failure.
 */
export const UpdateCategory = async (category: Category): Promise<Category | null> => {
    return CallApi(async () => {
        const response = await client.api.patch<Category>("/api/Category/category", category);
        return response.data;
    }, null);
};

//************************************//
//*********** PUT METHODS ************//
//************************************//

/**
 * Puts one territory's categories in a new order, the order of the tabs.
 * @param ids Every category id of that territory, in the new order.
 * @returns The categories as the catalog lists them, or null on failure.
 */
export const ReorderCategories = async (ids: number[]): Promise<Category[] | null> => {
    return CallApi(async () => {
        const response = await client.api.put<Category[]>("/api/Category/categories/order", ids);
        return response.data;
    }, null);
};

//***************************************//
//*********** DELETE METHODS ************//
//***************************************//

/**
 * Removes an empty category. One with items in it is refused until they are moved.
 * @param id The category id.
 * @returns True if the operation was successful, false otherwise.
 */
export const DeleteCategory = async (id: number): Promise<boolean> => {
    return CallApi(async () => {
        const response = await client.api.delete(`/api/Category/category/${id}`);
        return response.status === 200;
    }, false);
};
