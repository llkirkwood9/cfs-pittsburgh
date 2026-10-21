import { Redirect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
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
import { useAuth } from "../Context/AuthContext";
import { useTerritory } from "../Context/TerritoryContext";
import { useRefreshOnFocus } from "../Hooks/UseRefreshOnFocus";
import { ShareTextFile } from "../Lib/Files";
import { FormatCurrency } from "../Lib/ModelHelpers";
import { DiscountText, HasDiscount, OnSale, SaleFor } from "../Lib/Pricing";
import { ProductSortOptions, SortProducts } from "../Lib/ProductSort";
import type { ProductSortKey } from "../Lib/ProductSort";
import { Toast } from "../Lib/Toast";
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

const meta = "text-xs text-zinc-500 dark:text-zinc-400";

/**
 * Catalog administration. Everything the floor can sell is defined here: products, the sizes and
 * configurations they come in, their prices, which delivery services each one offers, and the
 * kinds of financing offered at checkout. Every territory has its own catalog; this is the one of
 * the territory picked in the menu bar. Someone with more than one territory can copy items
 * across from another territory's catalog when adding one.
 */
const CatalogPage = () => {
    const { user } = useAuth();
    const { territories, territoryId: territoryInView } = useTerritory();
    const isSystemAdmin = user?.role === "SystemAdmin";
    // The user's other territories, to copy an item from.
    const copySources = territories.filter((t) => t.id !== territoryInView && t.isActive !== false);

    const [products, setProducts] = useState<Product[]>([]);
    const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>([]);
    const [financeOptions, setFinanceOptions] = useState<FinanceOption[]>([]);
    const [categories, setCategories] = useState<ProductCategory[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);

    const [tab, setTab] = useState<ProductCategory | "All" | "Delivery" | "Financing">("Mattress");
    const [search, setSearch] = useState<string>("");
    const [sortKey, setSortKey] = useState<ProductSortKey>("name-asc");
    const [editing, setEditing] = useState<Product | null>(null);
    const [deleting, setDeleting] = useState<Product | null>(null);
    const [restoring, setRestoring] = useState<boolean>(false);
    const [exporting, setExporting] = useState<boolean>(false);

    const load = useCallback(async () => {
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
    }, []);

    useEffect(() => {
        load();
    }, [load]);

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

    // Back on this screen: read it again.
    useRefreshOnFocus(load);

    if (!user) return <Redirect href="/unauthorized" />;

    const handleRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

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

    // Saved through the share sheet - to Files, iCloud Drive, Mail - as the dashboard downloads it.
    const handleExport = async () => {
        setExporting(true);
        const file = await ExportCatalog();
        if (file) {
            await ShareTextFile(
                `catalog-${new Date().toLocaleDateString("en-CA")}.json`,
                JSON.stringify(file, null, 2),
                "application/json",
                "public.json"
            );
            Toast.Success(`Catalog exported: ${file.products?.length ?? 0} products.`);
        }
        setExporting(false);
    };

    const handleSaveDeliveryOption = async (option: DeliveryOption) => {
        const saved = option.id ? await UpdateDeliveryOption(option) : await AddDeliveryOption(option);

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
        const saved = option.id ? await UpdateFinanceOption(option) : await AddFinanceOption(option);

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
        return low === high ? FormatCurrency(low) : `${FormatCurrency(low)} - ${FormatCurrency(high)}`;
    };

    // How many of a tracked product's sizes are on hand, and how many sizes aren't counted.
    const stockSummary = (product: Product): string => {
        const variants = product.variants ?? [];
        const onHand = variants.reduce(
            (sum, v) =>
                sum +
                (v.excludeFromInventory
                    ? 0
                    : v.stocks
                      ? v.stocks.reduce((n, st) => n + (st.quantityOnHand ?? 0), 0)
                      : (v.quantityOnHand ?? 0)),
            0
        );
        const excluded = variants.filter((v) => v.excludeFromInventory).length;
        return `Tracked · ${onHand} on hand${excluded ? ` (${excluded} not counted)` : ""}`;
    };

    if (loading) {
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
                            onClick={handleExport}
                            loading={exporting}
                            className="bg-zinc-600 dark:bg-zinc-600"
                        />
                        <Button
                            text="Restore catalog"
                            icon="fa-solid fa-file-import"
                            onClick={() => setRestoring(true)}
                            className="bg-zinc-600 dark:bg-zinc-600"
                        />
                    </>
                )}
                {tab !== "Delivery" && tab !== "Financing" && (
                    <Button
                        text="New product"
                        icon="fa-solid fa-plus"
                        onClick={() =>
                            setEditing({
                                territoryId: territoryInView,
                                category: tab === "All" ? "Misc" : (tab as ProductCategory),
                                isActive: true,
                                variants: [],
                                deliveryOptions: [],
                            })
                        }
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
            </ScrollView>

            {tab === "Financing" ? (
                <FinanceOptionList
                    options={financeOptions}
                    onSave={handleSaveFinanceOption}
                    onDelete={handleDeleteFinanceOption}
                    onReorder={handleReorderFinanceOptions}
                />
            ) : tab === "Delivery" ? (
                <DeliveryOptionList
                    options={deliveryOptions}
                    onSave={handleSaveDeliveryOption}
                    onDelete={handleDeleteDeliveryOption}
                    onReorder={handleReorderDeliveryOptions}
                    permanentDelete={isSystemAdmin}
                />
            ) : (
                <>
                    <TextField
                        label="Search"
                        value={search}
                        onChange={setSearch}
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
                                active={sortKey === option.key}
                                onClick={() => setSortKey(option.key)}
                            />
                        ))}
                    </ScrollView>

                    <View className="gap-2">
                        {filtered.map((product) => (
                            <SwipeRow
                                key={product.id}
                                onPress={() => setEditing(product)}
                                actions={[
                                    {
                                        label: "Delete",
                                        icon: "fa-solid fa-trash",
                                        tone: "danger",
                                        onPress: () => setDeleting(product),
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
                                                    {HasDiscount(SaleFor(product))
                                                        ? `Sale ${DiscountText(SaleFor(product))} off`
                                                        : "Sale on some sizes"}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                    <View className="flex-row flex-wrap gap-x-2">
                                        <Text className={meta}>{product.brand}</Text>
                                        <Text className={meta}>{product.variants?.length ?? 0} sizes</Text>
                                        <Text className={meta}>{priceRange(product)}</Text>
                                        {(product.options ?? []).length > 0 && (
                                            <Text className={meta}>
                                                {(product.options ?? []).map((o) => o.name).join(", ")}
                                            </Text>
                                        )}
                                        {product.trackInventory && (
                                            <Text className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                                {stockSummary(product)}
                                            </Text>
                                        )}
                                        <Text className={meta}>
                                            {product.deliveryOptions?.length ?? 0} delivery option
                                            {(product.deliveryOptions?.length ?? 0) === 1 ? "" : "s"}
                                        </Text>
                                    </View>
                                    {product.notes ? (
                                        <Text className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                                            {product.notes}
                                        </Text>
                                    ) : null}
                                </View>

                                <Icon icon="fa-solid fa-chevron-right" className="text-xs text-zinc-400" />
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
                    catalog={products.filter((p) => p.isActive)}
                    categories={categories}
                    deliveryOptions={deliveryOptions.filter((o) => o.isActive)}
                    onSave={handleSaveProduct}
                    onClose={() => setEditing(null)}
                    copySources={copySources}
                    onCopied={async (copy) => {
                        // Open the copy, so anything that differs here - a price - can be changed.
                        await load();
                        setEditing(copy);
                    }}
                />
            )}

            {restoring && <ImportCatalogModal onClose={() => setRestoring(false)} onRestored={load} />}

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
                    onConfirm={handleDeleteProduct}
                    onCancel={() => setDeleting(null)}
                />
            )}
        </Page>
    );
};

export default CatalogPage;
