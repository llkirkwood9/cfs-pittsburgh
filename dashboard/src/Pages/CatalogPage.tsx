import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import Button from "../Components/Elements/Button";
import ConfirmationModal from "../Components/Elements/ConfirmationModal";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import TabButton from "../Components/Elements/TabButton";
import TextField from "../Components/Elements/TextField";
import { ScopeBadge } from "../Components/Catalog/CatalogScope";
import DeliveryOptionList from "../Components/Catalog/DeliveryOptionList";
import EditProductForm from "../Components/Catalog/EditProductForm";
import FinanceOptionList from "../Components/Catalog/FinanceOptionList";
import ImportCatalogModal from "../Components/Catalog/ImportCatalogModal";
import { useAuth } from "../Context/AuthContext";
import { useTerritory } from "../Context/TerritoryContext";
import { FormatCurrency } from "../Lib/ModelHelpers";
import { DiscountText, HasDiscount, OnSale, SaleFor } from "../Lib/Pricing";
import { ProductSortOptions, SortProducts, type ProductSortKey } from "../Lib/ProductSort";
import { Toast } from "../Lib/Toast";
import type { DeliveryOption } from "../Models/DeliveryOption";
import type { FinanceOption } from "../Models/FinanceOption";
import { ExportCatalog } from "../Services/CatalogServices";
import type { Product, ProductCategory } from "../Models/Product";
import { IsCompanyWide } from "../Models/User";
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

/**
 * Catalog administration. Everything the floor can sell is defined here: products, the sizes and
 * configurations they come in, their prices, which delivery services each one offers, and the
 * kinds of financing offered at checkout. Global items are sold in every territory and only
 * system admins and administrators change them; a manager adds and looks after items for their
 * own territory.
 */
const CatalogPage = () => {
    const { user } = useAuth();
    const { territories, territoryId: territoryInView, territoryName } = useTerritory();
    const isSystemAdmin = user?.role === "SystemAdmin";
    const companyWide = IsCompanyWide(user?.role);

    const [products, setProducts] = useState<Product[]>([]);
    const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>([]);
    const [financeOptions, setFinanceOptions] = useState<FinanceOption[]>([]);
    const [categories, setCategories] = useState<ProductCategory[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    const [tab, setTab] = useState<ProductCategory | "All" | "Delivery" | "Financing">("Mattress");
    const [search, setSearch] = useState<string>("");
    const [sortKey, setSortKey] = useState<ProductSortKey>("name-asc");
    const [editing, setEditing] = useState<Product | null>(null);
    const [deleting, setDeleting] = useState<Product | null>(null);
    const [restoring, setRestoring] = useState<boolean>(false);
    const [exporting, setExporting] = useState<boolean>(false);

    const load = async () => {
        setLoading(true);
        const [catalog, options, financing, cats] = await Promise.all([
            GetProducts(true),
            GetDeliveryOptions(true),
            GetFinanceOptions(true),
            GetCategories(),
        ]);
        setProducts(catalog);
        setDeliveryOptions(options);
        setFinanceOptions(financing);
        setCategories(cats);
        setLoading(false);
    };

    useEffect(() => {
        load();
    }, []);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        const matches = products.filter((product) => {
            if (
                tab !== "All" &&
                tab !== "Delivery" &&
                tab !== "Financing" &&
                product.category !== tab
            )
                return false;
            if (!term) return true;
            return (
                (product.name ?? "").toLowerCase().includes(term) ||
                (product.brand ?? "").toLowerCase().includes(term)
            );
        });
        // Sorted as the Add item list is: categories in tab order, the chosen sort within each.
        return SortProducts(matches, sortKey, categories);
    }, [products, tab, search, sortKey, categories]);

    if (!user) return <Navigate to="/unauthorized" replace />;

    const handleSaveProduct = async (product: Product) => {
        const saved = product.id ? await UpdateProduct(product) : await AddProduct(product);
        if (!saved) return;

        Toast.Success(`${saved.name} saved.`);
        await load();
    };

    const handleDeleteProduct = async () => {
        if (!deleting?.id) return;

        const success = await DeleteProduct(deleting.id, isSystemAdmin);
        setDeleting(null);

        if (success) {
            Toast.Success("Product removed.");
            await load();
        }
    };

    const handleExport = async () => {
        setExporting(true);
        const file = await ExportCatalog();
        setExporting(false);
        if (!file) return;

        const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `catalog-${new Date().toLocaleDateString("en-CA")}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);

        Toast.Success(`Catalog exported: ${file.products?.length ?? 0} products.`);
    };

    const handleSaveDeliveryOption = async (option: DeliveryOption) => {
        const saved = option.id
            ? await UpdateDeliveryOption(option)
            : await AddDeliveryOption(option);

        if (!saved) return;

        Toast.Success(`${saved.name} saved.`);
        await load();
    };

    const handleDeleteDeliveryOption = async (id: number) => {
        if (await DeleteDeliveryOption(id, isSystemAdmin)) {
            Toast.Success("Delivery option removed.");
            await load();
        }
    };

    const handleReorderDeliveryOptions = async (ids: number[]) => {
        const reordered = await ReorderDeliveryOptions(ids);
        if (reordered) setDeliveryOptions(reordered);
    };

    const handleSaveFinanceOption = async (option: FinanceOption) => {
        const saved = option.id
            ? await UpdateFinanceOption(option)
            : await AddFinanceOption(option);

        if (!saved) return;

        Toast.Success(`${saved.name} saved.`);
        setFinanceOptions(await GetFinanceOptions(true));
    };

    const handleDeleteFinanceOption = async (id: number) => {
        if (await DeleteFinanceOption(id)) {
            Toast.Success("Financing option removed.");
            setFinanceOptions(await GetFinanceOptions(true));
        }
    };

    const handleReorderFinanceOptions = async (ids: number[]) => {
        const reordered = await ReorderFinanceOptions(ids);
        if (reordered) setFinanceOptions(reordered);
    };

    const priceRange = (product: Product): string => {
        const prices = (product.variants ?? [])
            .map((v) => v.price)
            .filter((p): p is number => p !== null && p !== undefined);

        if (prices.length === 0) return "No prices set";

        const low = Math.min(...prices);
        const high = Math.max(...prices);
        return low === high
            ? FormatCurrency(low)
            : `${FormatCurrency(low)} - ${FormatCurrency(high)}`;
    };

    if (loading) {
        return (
            <div className="mx-auto max-w-screen-2xl p-4">
                <ListSkeleton rows={6} />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-screen-2xl p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-xl font-bold">Catalog</h1>
                <div className="flex flex-wrap gap-2">
                    {isSystemAdmin && (
                        <>
                            <Button
                                text="Export catalog"
                                icon="fa-solid fa-file-export"
                                onClick={handleExport}
                                loading={exporting}
                                className="bg-zinc-600 hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                            />
                            <Button
                                text="Restore catalog"
                                icon="fa-solid fa-file-import"
                                onClick={() => setRestoring(true)}
                                className="bg-zinc-600 hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                            />
                        </>
                    )}
                    {tab !== "Delivery" && tab !== "Financing" && (
                        <Button
                            text="New product"
                            icon="fa-solid fa-plus"
                            onClick={() =>
                                setEditing({
                                    category: tab === "All" ? "Misc" : (tab as ProductCategory),
                                    // New items go in the territory being viewed, or global from All.
                                    territoryId: companyWide ? territoryInView : user.territoryId,
                                    isActive: true,
                                    variants: [],
                                    deliveryOptions: [],
                                })
                            }
                            className="bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                        />
                    )}
                </div>
            </div>

            {!companyWide && (
                <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
                    Global items are set company-wide and can&apos;t be changed here. Anything you
                    add is sold in {territoryName || "your territory"} only.
                </p>
            )}

            <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
                <TabButton text="All" active={tab === "All"} onClick={() => setTab("All")} />
                {categories.map((category) => (
                    <TabButton
                        key={category}
                        text={category}
                        active={tab === category}
                        onClick={() => setTab(category)}
                        badge={products.filter((p) => p.category === category).length}
                    />
                ))}
                <TabButton
                    text="Delivery"
                    active={tab === "Delivery"}
                    onClick={() => setTab("Delivery")}
                    badge={deliveryOptions.length}
                />
                <TabButton
                    text="Financing Options"
                    active={tab === "Financing"}
                    onClick={() => setTab("Financing")}
                    badge={financeOptions.length}
                />
            </div>

            {tab === "Financing" ? (
                <FinanceOptionList
                    options={financeOptions}
                    onSave={handleSaveFinanceOption}
                    onDelete={handleDeleteFinanceOption}
                    onReorder={handleReorderFinanceOptions}
                    territories={territories}
                    canChooseTerritory={companyWide}
                    ownTerritoryName={territoryName}
                    defaultTerritoryId={companyWide ? territoryInView : (user.territoryId ?? null)}
                />
            ) : tab === "Delivery" ? (
                <DeliveryOptionList
                    options={deliveryOptions}
                    onSave={handleSaveDeliveryOption}
                    onDelete={handleDeleteDeliveryOption}
                    onReorder={handleReorderDeliveryOptions}
                    permanentDelete={isSystemAdmin}
                    territories={territories}
                    canChooseTerritory={companyWide}
                    ownTerritoryName={territoryName}
                    defaultTerritoryId={companyWide ? territoryInView : (user.territoryId ?? null)}
                />
            ) : (
                <>
                    <TextField
                        label="Search"
                        value={search}
                        onChange={setSearch}
                        placeholder="Model or brand"
                        className="mb-3 max-w-md"
                    />

                    <div className="-mx-1 mb-3 flex items-center gap-2 overflow-x-auto px-1 pb-1">
                        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Sort
                        </span>
                        {ProductSortOptions.map((option) => (
                            <TabButton
                                key={option.key}
                                text={option.label}
                                active={sortKey === option.key}
                                onClick={() => setSortKey(option.key)}
                            />
                        ))}
                    </div>

                    <ul className="space-y-2">
                        {filtered.map((product) => (
                            <li
                                key={product.id}
                                className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 shadow-sm dark:bg-zinc-800"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold">
                                        {product.name}
                                        <ScopeBadge territoryName={product.territoryName} />
                                        {!product.isActive && (
                                            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                                                Archived
                                            </span>
                                        )}
                                        {OnSale(product) && (
                                            <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-xs font-semibold text-rose-800 dark:bg-rose-900/50 dark:text-rose-300">
                                                {HasDiscount(SaleFor(product))
                                                    ? `Sale ${DiscountText(SaleFor(product))} off`
                                                    : "Sale on some sizes"}
                                            </span>
                                        )}
                                    </p>
                                    <p className="flex flex-wrap gap-x-2 text-xs text-zinc-500 dark:text-zinc-400">
                                        <span>{product.brand}</span>
                                        <span>{product.variants?.length ?? 0} sizes</span>
                                        <span>{priceRange(product)}</span>
                                        {(product.options ?? []).length > 0 && (
                                            <span>
                                                {(product.options ?? [])
                                                    .map((o) => o.name)
                                                    .join(", ")}
                                            </span>
                                        )}
                                        {product.trackInventory && (
                                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                                Tracked
                                                {/* Stock is counted per territory, so there's no one figure for All. */}
                                                {territoryInView != null && (
                                                    <>
                                                        {" "}
                                                        &middot;{" "}
                                                        {(product.variants ?? []).reduce(
                                                            (sum, v) =>
                                                                sum +
                                                                (v.excludeFromInventory
                                                                    ? 0
                                                                    : v.stocks
                                                                      ? v.stocks.reduce(
                                                                            (n, st) =>
                                                                                n +
                                                                                (st.quantityOnHand ??
                                                                                    0),
                                                                            0
                                                                        )
                                                                      : (v.quantityOnHand ?? 0)),
                                                            0
                                                        )}{" "}
                                                        on hand
                                                    </>
                                                )}
                                                {(product.variants ?? []).some(
                                                    (v) => v.excludeFromInventory
                                                ) &&
                                                    ` (${
                                                        (product.variants ?? []).filter(
                                                            (v) => v.excludeFromInventory
                                                        ).length
                                                    } not counted)`}
                                            </span>
                                        )}
                                        <span>
                                            {product.deliveryOptions?.length ?? 0} delivery option
                                            {(product.deliveryOptions?.length ?? 0) === 1
                                                ? ""
                                                : "s"}
                                        </span>
                                    </p>
                                    {product.notes && (
                                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                                            {product.notes}
                                        </p>
                                    )}
                                </div>

                                {product.canEdit === false ? (
                                    <span
                                        className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400"
                                        title="Global items are set by a system admin or administrator"
                                    >
                                        <Icon icon="fa-solid fa-lock" />
                                        Set company-wide
                                    </span>
                                ) : (
                                    <>
                                        <Button
                                            text="Edit"
                                            icon="fa-solid fa-pen"
                                            onClick={() => setEditing(product)}
                                            className="min-h-[40px] bg-zinc-500 px-3 text-sm hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setDeleting(product)}
                                            aria-label="Delete product"
                                            className="flex h-10 w-10 items-center justify-center rounded-lg text-red-700
                                                hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-950/40"
                                        >
                                            <Icon icon="fa-solid fa-trash" />
                                        </button>
                                    </>
                                )}
                            </li>
                        ))}

                        {filtered.length === 0 && (
                            <li className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                                Nothing here yet.
                            </li>
                        )}
                    </ul>
                </>
            )}

            {editing && (
                <EditProductForm
                    product={editing}
                    catalog={products.filter((p) => p.isActive)}
                    categories={categories}
                    deliveryOptions={deliveryOptions.filter((o) => o.isActive)}
                    onSave={handleSaveProduct}
                    onClose={() => setEditing(null)}
                    territories={territories}
                    canChooseTerritory={companyWide}
                    ownTerritoryName={territoryName}
                />
            )}

            {restoring && (
                <ImportCatalogModal onClose={() => setRestoring(false)} onRestored={load} />
            )}

            {deleting && (
                <ConfirmationModal
                    title="Delete product"
                    message={
                        isSystemAdmin
                            ? `Permanently delete "${deleting.name}" and all its sizes? Past sales sheets keep the item exactly as it was printed, but it leaves the catalog, any bundle that included it, and the inventory. This cannot be undone. To keep it, untick "Offered on the floor" instead.`
                            : `Delete "${deleting.name}"? If it has already been sold it will be archived instead, so past receipts keep working.`
                    }
                    confirmText={isSystemAdmin ? "Delete for good" : "Delete"}
                    confirmWord={isSystemAdmin ? "DELETE" : undefined}
                    destructive
                    onConfirm={handleDeleteProduct}
                    onCancel={() => setDeleting(null)}
                />
            )}
        </div>
    );
};

export default CatalogPage;
