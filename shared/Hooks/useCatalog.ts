import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toast } from "@host";
import { useAuth } from "../Context/AuthContext";
import { useTerritory } from "../Context/TerritoryContext";
import {
    AllTab,
    CatalogMatches,
    CategoriesFor,
    CopySources,
    IsProductTab,
    NewProduct,
} from "../Lib/Catalog";
import type { CatalogTab } from "../Lib/Catalog";
import { SortProducts } from "../Lib/ProductSort";
import type { ProductSortKey } from "../Lib/ProductSort";
import type { DeliveryOption } from "../Models/DeliveryOption";
import type { FinanceOption } from "../Models/FinanceOption";
import type { Category } from "../Models/Category";
import type { Product } from "../Models/Product";
import { ExportCatalog } from "../Services/CatalogServices";
import {
    AddCategory,
    DeleteCategory,
    GetCategories,
    ReorderCategories,
    UpdateCategory,
} from "../Services/CategoryServices";
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
import { AddProduct, DeleteProduct, GetProducts, UpdateProduct } from "../Services/ProductServices";

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
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    // True while the catalog is read again after the first time, as after a save.
    const [reloading, setReloading] = useState<boolean>(false);
    const loaded = useRef<boolean>(false);

    // Until a tab is picked, the first category's.
    const [pickedTab, setTab] = useState<CatalogTab | null>(null);
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

    // The territory in view's categories, or every name once when viewing all territories.
    const inView = useMemo(
        () => CategoriesFor(categories, territoryInView),
        [categories, territoryInView]
    );
    const categoryTabs = useMemo(() => inView.map((c) => c.name ?? ""), [inView]);
    // A category renamed or deleted since it was picked falls back to the first.
    const tab =
        pickedTab !== null &&
        (!IsProductTab(pickedTab) || pickedTab === AllTab || categoryTabs.includes(pickedTab))
            ? pickedTab
            : (categoryTabs[0] ?? AllTab);

    // Sorted as the Add item list is: categories in tab order, the chosen sort within each.
    const filtered = useMemo(
        () => SortProducts(CatalogMatches(products, tab, search), sortKey, categoryTabs),
        [products, tab, search, sortKey, categoryTabs]
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

    // Products show their category's name and are listed in category order, so a change to the
    // categories reads the whole catalog again.
    const saveCategory = async (category: Category) => {
        const saved = category.id
            ? await UpdateCategory(category)
            : await AddCategory({ ...category, territoryId: territoryInView });
        if (!saved) return;

        Toast.Success(`${saved.name} saved.`);
        await load();
    };

    const deleteCategory = async (id: number) => {
        if (await DeleteCategory(id)) {
            Toast.Success("Category removed.");
            await load();
        }
    };

    const reorderCategories = async (ids: number[]) => {
        if (await ReorderCategories(ids)) await load();
    };

    return {
        isSystemAdmin,
        load,
        loading,
        reloading,
        products,
        deliveryOptions,
        financeOptions,
        /** The territory in view's categories, each territory's when viewing them all. */
        categories: inView,
        /** Every category in view, to pick a product's from its own territory's. */
        categoriesFor: (territoryId: number | null | undefined) =>
            CategoriesFor(categories, territoryId ?? territoryInView),
        /** The category tabs, in order. */
        categoryTabs,
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
        countIn: (category: string) => products.filter((p) => p.category === category).length,
        editing,
        setEditing,
        /** Opens a blank product in the tab's category. */
        newProduct: (from: CatalogTab) =>
            setEditing(
                NewProduct(from, territoryInView, CategoriesFor(categories, territoryInView))
            ),
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
        saveCategory,
        deleteCategory,
        reorderCategories,
    };
};
