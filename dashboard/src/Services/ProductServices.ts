import api from "../Lib/api";
import { HandleAxiosError } from "../Lib/ErrorHandler";
import type { Product, ProductCategory } from "../Models/Product";

//*************************************//
//*********** POST METHODS ************//
//*************************************//

/**
 * Adds a product with its variants and delivery availability.
 * @param newProductData The data for the new product.
 * @returns The created product, or null on failure.
 */
export const AddProduct = async (newProductData: Product): Promise<Product | null> => {
    try {
        const response = await api.post<Product>("/api/Product/product", newProductData);
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};

//************************************//
//*********** GET METHODS ************//
//************************************//

/**
 * Lists the catalog.
 * @param includeInactive Pass true from the catalog admin screen.
 * @returns Products with variants and delivery options, or an empty list on failure.
 */
export const GetProducts = async (includeInactive = false): Promise<Product[]> => {
    try {
        const response = await api.get<Product[]>("/api/Product/products", {
            params: { includeInactive },
        });
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return [];
    }
};

/**
 * Gets a single product.
 * @param id The product id.
 * @returns The product, or null on failure.
 */
export const GetProduct = async (id: number): Promise<Product | null> => {
    try {
        const response = await api.get<Product>(`/api/Product/product/${id}`);
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};

/**
 * Lists the product category names.
 * @returns Category names, or an empty list on failure.
 */
export const GetCategories = async (): Promise<ProductCategory[]> => {
    try {
        const response = await api.get<ProductCategory[]>("/api/Product/categories");
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return [];
    }
};

//**************************************//
//*********** PATCH METHODS ************//
//**************************************//

/**
 * Updates a product, replacing its variants and delivery options when supplied.
 * @param productData The fields to change, including the id.
 * @returns The updated product, or null on failure.
 */
export const UpdateProduct = async (productData: Product): Promise<Product | null> => {
    try {
        const response = await api.patch<Product>("/api/Product/product", productData);
        return response.data;
    } catch (error) {
        HandleAxiosError(error);
        return null;
    }
};

//***************************************//
//*********** DELETE METHODS ************//
//***************************************//

/**
 * Removes a product, or archives it when it already appears on an order.
 * @param id The product id.
 * @param permanent System admin only: delete for good.
 * @returns True if the operation was successful, false otherwise.
 */
export const DeleteProduct = async (id: number, permanent = false): Promise<boolean> => {
    try {
        // permanent is system-admin-only: it deletes for good instead of archiving or refusing.
        const response = await api.delete(`/api/Product/product/${id}`, {
            params: permanent ? { permanent: true } : undefined,
        });
        return response.status === 200;
    } catch (error) {
        HandleAxiosError(error);
        return false;
    }
};
