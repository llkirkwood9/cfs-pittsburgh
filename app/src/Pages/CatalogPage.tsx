import { useState } from "react";
import { ScrollView, View } from "react-native";
import CategoryList from "../Components/Catalog/CategoryList";
import DeliveryOptionList from "../Components/Catalog/DeliveryOptionList";
import EditProductForm from "../Components/Catalog/EditProductForm";
import FinanceOptionList from "../Components/Catalog/FinanceOptionList";
import ImportCatalogModal from "../Components/Catalog/ImportCatalogModal";
import Button from "../Components/Elements/Button";
import ConfirmationModal from "../Components/Elements/ConfirmationModal";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import Page from "../Components/Elements/Page";
import SwipeRow from "../Components/Elements/SwipeRow";
import TabButton from "../Components/Elements/TabButton";
import Text from "../Components/Elements/Text";
import TextField from "../Components/Elements/TextField";
import { useRefreshOnFocus } from "../Hooks/UseRefreshOnFocus";
import { ShareTextFile } from "../Lib/Files";
import { useCatalog } from "@shared/Hooks/useCatalog";
import {
    AllTab,
    CatalogListTabs,
    DeliveryCountText,
    IsProductTab,
    PriceRangeText,
    ProductStockSummary,
    SaleBadgeText,
} from "@shared/Lib/Catalog";
import { OnSale } from "@shared/Lib/Pricing";
import { ProductSortOptions } from "@shared/Lib/ProductSort";

const meta = "text-xs text-zinc-500 dark:text-zinc-400";

// Saved through the share sheet - to Files, iCloud Drive, Mail - as the dashboard downloads it.
const ShareJson = (fileName: string, text: string) =>
    ShareTextFile(fileName, text, "application/json", "public.json");

/**
 * Catalog administration. Everything the floor can sell is defined here: products, the sizes and
 * configurations they come in, their prices, which delivery services each one offers, and the
 * kinds of financing offered at checkout. Every territory has its own catalog; this is the one of
 * the territory picked in the menu bar. Someone with more than one territory can copy items
 * across from another territory's catalog when adding one.
 */
const CatalogPage = () => {
    const catalog = useCatalog({ saveExport: ShareJson });
    const { tab, setTab, filtered, isSystemAdmin, editing, deleting } = catalog;
    const [refreshing, setRefreshing] = useState<boolean>(false);

    // Back on this screen: read it again.
    useRefreshOnFocus(catalog.load);

    const handleRefresh = async () => {
        setRefreshing(true);
        await catalog.load();
        setRefreshing(false);
    };

    if (catalog.loading) {
        return (
            <Page edges={["left", "right"]}>
                <ListSkeleton rows={6} />
            </Page>
        );
    }

    return (
        <Page edges={["left", "right"]} onRefresh={handleRefresh} refreshing={refreshing}>
            <View className="mb-3 flex-row flex-wrap items-center justify-end gap-2">
                {isSystemAdmin && (
                    <>
                        <Button
                            text="Export catalog"
                            icon="fa-solid fa-file-export"
                            onClick={catalog.exportCatalog}
                            loading={catalog.exporting}
                            className="bg-zinc-600 dark:bg-zinc-600"
                        />
                        <Button
                            text="Restore catalog"
                            icon="fa-solid fa-file-import"
                            onClick={() => catalog.setRestoring(true)}
                            className="bg-zinc-600 dark:bg-zinc-600"
                        />
                    </>
                )}
                {IsProductTab(tab) && (
                    <Button
                        text="New product"
                        icon="fa-solid fa-plus"
                        onClick={() => catalog.newProduct(tab)}
                        className="bg-green-700 dark:bg-green-600"
                    />
                )}
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-3"
                contentContainerClassName="gap-2 pb-1"
            >
                <TabButton text="All" active={tab === AllTab} onClick={() => setTab(AllTab)} />
                {catalog.categoryTabs.map((category) => (
                    <TabButton
                        key={category}
                        text={category}
                        active={tab === category}
                        onClick={() => setTab(category)}
                        badge={catalog.countIn(category)}
                    />
                ))}
                <TabButton
                    text="Categories"
                    active={tab === CatalogListTabs.Categories}
                    onClick={() => setTab(CatalogListTabs.Categories)}
                    badge={catalog.categories.length}
                />
                <TabButton
                    text="Delivery"
                    active={tab === CatalogListTabs.Delivery}
                    onClick={() => setTab(CatalogListTabs.Delivery)}
                    badge={catalog.deliveryOptions.length}
                />
                <TabButton
                    text="Financing Options"
                    active={tab === CatalogListTabs.Financing}
                    onClick={() => setTab(CatalogListTabs.Financing)}
                    badge={catalog.financeOptions.length}
                />
            </ScrollView>

            {tab === CatalogListTabs.Categories ? (
                <CategoryList
                    categories={catalog.categories}
                    onSave={catalog.saveCategory}
                    onDelete={catalog.deleteCategory}
                    onReorder={catalog.reorderCategories}
                />
            ) : tab === CatalogListTabs.Financing ? (
                <FinanceOptionList
                    options={catalog.financeOptions}
                    onSave={catalog.saveFinanceOption}
                    onDelete={catalog.deleteFinanceOption}
                    onReorder={catalog.reorderFinanceOptions}
                />
            ) : tab === CatalogListTabs.Delivery ? (
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
                        autoCapitalize="none"
                        className="mb-3 max-w-md"
                    />

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        className="mb-3"
                        contentContainerClassName="items-center gap-2 pb-1"
                    >
                        <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Sort
                        </Text>
                        {ProductSortOptions.map((option) => (
                            <TabButton
                                key={option.key}
                                text={option.label}
                                active={catalog.sortKey === option.key}
                                onClick={() => catalog.setSortKey(option.key)}
                            />
                        ))}
                    </ScrollView>

                    <View className="gap-2">
                        {filtered.map((product) => (
                            <SwipeRow
                                key={product.id}
                                onPress={() => catalog.setEditing(product)}
                                actions={[
                                    {
                                        label: "Delete",
                                        icon: "fa-solid fa-trash",
                                        tone: "danger",
                                        onPress: () => catalog.setDeleting(product),
                                    },
                                ]}
                                accessibilityLabel={`${product.name}, ${product.brand ?? ""}`}
                                className="flex-row items-center gap-3 p-3"
                            >
                                <View className="min-w-[200px] flex-1">
                                    <View className="flex-row flex-wrap items-center gap-2">
                                        <Text className="font-semibold">{product.name}</Text>
                                        {!product.isActive && (
                                            <View className="rounded bg-amber-100 px-1.5 py-0.5 dark:bg-amber-900/50">
                                                <Text className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                                                    Archived
                                                </Text>
                                            </View>
                                        )}
                                        {OnSale(product) && (
                                            <View className="rounded bg-rose-100 px-1.5 py-0.5 dark:bg-rose-900/50">
                                                <Text className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                                                    {SaleBadgeText(product)}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                    <View className="flex-row flex-wrap gap-x-2">
                                        <Text className={meta}>{product.brand}</Text>
                                        <Text className={meta}>
                                            {product.variants?.length ?? 0} sizes
                                        </Text>
                                        <Text className={meta}>{PriceRangeText(product)}</Text>
                                        {(product.options ?? []).length > 0 && (
                                            <Text className={meta}>
                                                {(product.options ?? [])
                                                    .map((o) => o.name)
                                                    .join(", ")}
                                            </Text>
                                        )}
                                        {product.trackInventory && (
                                            <Text className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                                {ProductStockSummary(product)}
                                            </Text>
                                        )}
                                        <Text className={meta}>{DeliveryCountText(product)}</Text>
                                    </View>
                                    {product.notes ? (
                                        <Text className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                                            {product.notes}
                                        </Text>
                                    ) : null}
                                </View>

                                <Icon
                                    icon="fa-solid fa-chevron-right"
                                    className="text-xs text-zinc-400"
                                />
                            </SwipeRow>
                        ))}

                        {filtered.length === 0 && (
                            <Text className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                                Nothing here yet.
                            </Text>
                        )}
                    </View>
                </>
            )}

            {editing && (
                <EditProductForm
                    product={editing}
                    catalog={catalog.activeProducts}
                    categories={catalog.categoriesFor(editing.territoryId)}
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
                            ? `Permanently delete "${deleting.name}" and all its sizes? Past sales sheets keep the item exactly as it was printed, but it leaves the catalog, any bundle that included it, and the inventory. This cannot be undone. To keep it, turn off "Offered on the floor" instead.`
                            : `Delete "${deleting.name}"? If it has already been sold it will be archived instead, so past receipts keep working.`
                    }
                    confirmText={isSystemAdmin ? "Delete for good" : "Delete"}
                    confirmWord={isSystemAdmin ? "DELETE" : undefined}
                    destructive
                    onConfirm={catalog.deleteProduct}
                    onCancel={() => catalog.setDeleting(null)}
                />
            )}
        </Page>
    );
};

export default CatalogPage;
