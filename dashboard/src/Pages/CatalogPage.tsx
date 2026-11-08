import Button from "../Components/Elements/Button";
import ConfirmationModal from "../Components/Elements/ConfirmationModal";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import TabButton from "../Components/Elements/TabButton";
import TextField from "../Components/Elements/TextField";
import DeliveryOptionList from "../Components/Catalog/DeliveryOptionList";
import EditProductForm from "../Components/Catalog/EditProductForm";
import FinanceOptionList from "../Components/Catalog/FinanceOptionList";
import ImportCatalogModal from "../Components/Catalog/ImportCatalogModal";
import { useCatalog } from "@shared/Hooks/useCatalog";
import {
    DeliveryCountText,
    IsProductTab,
    PriceRangeText,
    ProductStockSummary,
    SaleBadgeText,
} from "@shared/Lib/Catalog";
import { OnSale } from "@shared/Lib/Pricing";
import { ProductSortOptions } from "@shared/Lib/ProductSort";

/**
 * Downloads a JSON file.
 * @param fileName Its name.
 * @param text Its contents.
 */
const DownloadJson = (fileName: string, text: string) => {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};

/**
 * Catalog administration. Everything the floor can sell is defined here: products, the sizes and
 * configurations they come in, their prices, which delivery services each one offers, and the
 * kinds of financing offered at checkout. Every territory has its own catalog; this is the one of
 * the territory picked in the menu bar. Someone with more than one territory can copy items
 * across from another territory's catalog when adding one.
 */
const CatalogPage = () => {
    const catalog = useCatalog({ saveExport: DownloadJson, skeletonOnReload: true });
    const { tab, setTab, filtered, isSystemAdmin, editing, deleting } = catalog;

    if (catalog.loading) {
        return (
            <div className="mx-auto max-w-(--breakpoint-2xl) p-4">
                <ListSkeleton rows={6} />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-(--breakpoint-2xl) p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-xl font-bold">Catalog</h1>
                <div className="flex flex-wrap gap-2">
                    {isSystemAdmin && (
                        <>
                            <Button
                                text="Export catalog"
                                icon="fa-solid fa-file-export"
                                onClick={catalog.exportCatalog}
                                loading={catalog.exporting}
                                className="bg-zinc-600 hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                            />
                            <Button
                                text="Restore catalog"
                                icon="fa-solid fa-file-import"
                                onClick={() => catalog.setRestoring(true)}
                                className="bg-zinc-600 hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                            />
                        </>
                    )}
                    {IsProductTab(tab) && (
                        <Button
                            text="New product"
                            icon="fa-solid fa-plus"
                            onClick={() => catalog.newProduct(tab)}
                            className="bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                        />
                    )}
                </div>
            </div>

            <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
                <TabButton text="All" active={tab === "All"} onClick={() => setTab("All")} />
                {catalog.categories.map((category) => (
                    <TabButton
                        key={category}
                        text={category}
                        active={tab === category}
                        onClick={() => setTab(category)}
                        badge={catalog.countIn(category)}
                    />
                ))}
                <TabButton
                    text="Delivery"
                    active={tab === "Delivery"}
                    onClick={() => setTab("Delivery")}
                    badge={catalog.deliveryOptions.length}
                />
                <TabButton
                    text="Financing Options"
                    active={tab === "Financing"}
                    onClick={() => setTab("Financing")}
                    badge={catalog.financeOptions.length}
                />
            </div>

            {tab === "Financing" ? (
                <FinanceOptionList
                    options={catalog.financeOptions}
                    onSave={catalog.saveFinanceOption}
                    onDelete={catalog.deleteFinanceOption}
                    onReorder={catalog.reorderFinanceOptions}
                />
            ) : tab === "Delivery" ? (
                <DeliveryOptionList
                    options={catalog.deliveryOptions}
                    onSave={catalog.saveDeliveryOption}
                    onDelete={catalog.deleteDeliveryOption}
                    onReorder={catalog.reorderDeliveryOptions}
                    permanentDelete={isSystemAdmin}
                />
            ) : (
                <>
                    <TextField
                        label="Search"
                        value={catalog.search}
                        onChange={catalog.setSearch}
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
                                active={catalog.sortKey === option.key}
                                onClick={() => catalog.setSortKey(option.key)}
                            />
                        ))}
                    </div>

                    <ul className="space-y-2">
                        {filtered.map((product) => (
                            <li
                                key={product.id}
                                className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 shadow-xs dark:bg-zinc-800"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold">
                                        {product.name}
                                        {!product.isActive && (
                                            <span className="ml-2 rounded-sm bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                                                Archived
                                            </span>
                                        )}
                                        {OnSale(product) && (
                                            <span className="ml-2 rounded-sm bg-rose-100 px-1.5 py-0.5 text-xs font-semibold text-rose-800 dark:bg-rose-900/50 dark:text-rose-300">
                                                {SaleBadgeText(product)}
                                            </span>
                                        )}
                                    </p>
                                    <p className="flex flex-wrap gap-x-2 text-xs text-zinc-500 dark:text-zinc-400">
                                        <span>{product.brand}</span>
                                        <span>{product.variants?.length ?? 0} sizes</span>
                                        <span>{PriceRangeText(product)}</span>
                                        {(product.options ?? []).length > 0 && (
                                            <span>
                                                {(product.options ?? [])
                                                    .map((o) => o.name)
                                                    .join(", ")}
                                            </span>
                                        )}
                                        {product.trackInventory && (
                                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                                {ProductStockSummary(product)}
                                            </span>
                                        )}
                                        <span>{DeliveryCountText(product)}</span>
                                    </p>
                                    {product.notes && (
                                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                                            {product.notes}
                                        </p>
                                    )}
                                </div>

                                <Button
                                    text="Edit"
                                    icon="fa-solid fa-pen"
                                    onClick={() => catalog.setEditing(product)}
                                    className="min-h-[40px] bg-zinc-500 px-3 text-sm hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                                />
                                <button
                                    type="button"
                                    onClick={() => catalog.setDeleting(product)}
                                    aria-label="Delete product"
                                    className="flex h-10 w-10 items-center justify-center rounded-lg text-red-700
                                        hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-950/40"
                                >
                                    <Icon icon="fa-solid fa-trash" />
                                </button>
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
                    catalog={catalog.activeProducts}
                    categories={catalog.categories}
                    deliveryOptions={catalog.activeDeliveryOptions}
                    onSave={catalog.saveProduct}
                    onClose={() => catalog.setEditing(null)}
                    copySources={catalog.copySources}
                    onCopied={catalog.openCopy}
                />
            )}

            {catalog.restoring && (
                <ImportCatalogModal
                    onClose={() => catalog.setRestoring(false)}
                    onRestored={catalog.load}
                />
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
                    onConfirm={catalog.deleteProduct}
                    onCancel={() => catalog.setDeleting(null)}
                />
            )}
        </div>
    );
};

export default CatalogPage;
