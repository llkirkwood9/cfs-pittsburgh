import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toast } from "@host";
import { useAuth } from "../Context/AuthContext";
import { useTerritory } from "../Context/TerritoryContext";
import { CatalogMatches, CopySources, NewProduct } from "../Lib/Catalog";
import type { CatalogTab } from "../Lib/Catalog";
import { SortProducts } from "../Lib/ProductSort";
import type { ProductSortKey } from "../Lib/ProductSort";
import type { DeliveryOption } from "../Models/DeliveryOption";
import type { FinanceOption } from "../Models/FinanceOption";
import type { Product, ProductCategory } from "../Models/Product";
import { ExportCatalog } from "../Services/CatalogServices";
import {
    AddDeliveryOption,
    DeleteDeliveryOption,
    GetDeliveryOptions,
    ReorderDeliveryOptions,
    UpdateDeliveryOption,
} from "../Services/DeliveryOptionServices";
import {
    AddFinanceOption,
    DeleteFinanceOption,
    GetFinanceOptions,
    ReorderFinanceOptions,
    UpdateFinanceOption,
} from "../Services/FinanceOptionServices";
import {
    AddProduct,
    DeleteProduct,
    GetCategories,
    GetProducts,
    UpdateProduct,
} from "../Services/ProductServices";

type Options = {
    /** Saves the exported catalog file where the platform keeps files. */
    saveExport: (fileName: string, text: string) => Promise<unknown> | void;
};

/**
 * The Catalog screen: the territory's products, delivery and financing options and categories,
 * the tab, search and sort, and saving, deleting and reordering. Deleting is for good for a
 * system admin, who can also export and restore the whole catalog.
 * @param options How the platform saves an export.
 * @returns The state and handlers.
 */
export const useCatalog = ({ saveExport }: Options) => {
    const { hasRole } = useAuth();
    const { territories, territoryId: territoryInView } = useTerritory();
    const isSystemAdmin = hasRole("SystemAdmin");

    const [products, setProducts] = useState<Product[]>([]);
    const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>([]);
    const [financeOptions, setFinanceOptions] = useState<FinanceOption[]>([]);
    const [categories, setCategories] = useState<ProductCategory[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    // True while the catalog is read again after the first time, as after a save.
    const [reloading, setReloading] = useState<boolean>(false);
    const loaded = useRef<boolean>(false);

    const [tab, setTab] = useState<CatalogTab>("Mattress");
    const [search, setSearch] = useState<string>("");
    const [sortKey, setSortKey] = useState<ProductSortKey>("name-asc");
    const [editing, setEditing] = useState<Product | null>(null);
    const [deleting, setDeleting] = useState<Product | null>(null);
    const [restoring, setRestoring] = useState<boolean>(false);
    const [exporting, setExporting] = useState<boolean>(false);

    const load = useCallback(async () => {
        if (loaded.current) setReloading(true);
        const [catalog, options, financing, cats] = await Promise.all([
            GetProducts(true),
            GetDeliveryOptions(true),
            GetFinanceOptions(true),
            GetCategories(),
        ]);
        setProducts(catalog ?? []);
        setDeliveryOptions(options ?? []);
        setFinanceOptions(financing ?? []);
        setCategories(cats ?? []);
        loaded.current = true;
        setLoading(false);
        setReloading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    // Sorted as the Add item list is: categories in tab order, the chosen sort within each.
    const filtered = useMemo(
        () => SortProducts(CatalogMatches(products, tab, search), sortKey, categories),
        [products, tab, search, sortKey, categories]
    );

    const saveProduct = async (product: Product) => {
        const saved = product.id ? await UpdateProduct(product) : await AddProduct(product);
        if (!saved) return;

        Toast.Success(`${saved.name} saved.`);
        await load();
    };

    const deleteProduct = async () => {
        if (!deleting?.id) return;

        const success = await DeleteProduct(deleting.id, isSystemAdmin);
        setDeleting(null);

        if (success) {
            Toast.Success("Product removed.");
            await load();
        }
    };

    /** Opens a copy made from another territory's item, so anything that differs here - a price - can be changed. */
    const openCopy = async (copy: Product) => {
        await load();
        setEditing(copy);
    };

    const exportCatalog = async () => {
        setExporting(true);
        const file = await ExportCatalog();
        if (file) {
            await saveExport(
                `catalog-${new Date().toLocaleDateString("en-CA")}.json`,
                JSON.stringify(file, null, 2)
            );
            Toast.Success(`Catalog exported: ${file.products?.length ?? 0} products.`);
        }
        setExporting(false);
    };

    const saveDeliveryOption = async (option: DeliveryOption) => {
        const saved = option.id
            ? await UpdateDeliveryOption(option)
            : await AddDeliveryOption(option);
        if (!saved) return;

        Toast.Success(`${saved.name} saved.`);
        await load();
    };

    const deleteDeliveryOption = async (id: number) => {
        if (await DeleteDeliveryOption(id, isSystemAdmin)) {
            Toast.Success("Delivery option removed.");
            await load();
        }
    };

    const reorderDeliveryOptions = async (ids: number[]) => {
        const reordered = await ReorderDeliveryOptions(ids);
        if (reordered) setDeliveryOptions(reordered);
    };

    const saveFinanceOption = async (option: FinanceOption) => {
        const saved = option.id
            ? await UpdateFinanceOption(option)
            : await AddFinanceOption(option);
        if (!saved) return;

        Toast.Success(`${saved.name} saved.`);
        const financing = await GetFinanceOptions(true);
        if (financing) setFinanceOptions(financing);
    };

    const deleteFinanceOption = async (id: number) => {
        if (await DeleteFinanceOption(id)) {
            Toast.Success("Financing option removed.");
            const financing = await GetFinanceOptions(true);
            if (financing) setFinanceOptions(financing);
        }
    };

    const reorderFinanceOptions = async (ids: number[]) => {
        const reordered = await ReorderFinanceOptions(ids);
        if (reordered) setFinanceOptions(reordered);
    };

    return {
        isSystemAdmin,
        load,
        loading,
        reloading,
        products,
        deliveryOptions,
        financeOptions,
        categories,
        /** Products a bundle can include, and delivery options a product can offer: the active ones. */
        activeProducts: products.filter((p) => p.isActive),
        activeDeliveryOptions: deliveryOptions.filter((o) => o.isActive),
        /** The user's other territories, to copy an item from. */
        copySources: CopySources(territories, territoryInView),
        tab,
        setTab,
        search,
        setSearch,
        sortKey,
        setSortKey,
        filtered,
        /** How many products a category's tab holds. */
        countIn: (category: ProductCategory) =>
            products.filter((p) => p.category === category).length,
        editing,
        setEditing,
        /** Opens a blank product in the tab's category. */
        newProduct: (from: ProductCategory | "All") =>
            setEditing(NewProduct(from, territoryInView)),
        openCopy,
        saveProduct,
        deleting,
        setDeleting,
        deleteProduct,
        restoring,
        setRestoring,
        exporting,
        exportCatalog,
        saveDeliveryOption,
        deleteDeliveryOption,
        reorderDeliveryOptions,
        saveFinanceOption,
        deleteFinanceOption,
        reorderFinanceOptions,
    };
};
