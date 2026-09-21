import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import Button from "../Components/Elements/Button";
import ConfirmationModal from "../Components/Elements/ConfirmationModal";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import TabButton from "../Components/Elements/TabButton";
import TextField from "../Components/Elements/TextField";
import DeliveryOptionList from "../Components/Catalog/DeliveryOptionList";
import EditProductForm from "../Components/Catalog/EditProductForm";
import { useAuth } from "../Context/AuthContext";
import { FormatCurrency } from "../Lib/ModelHelpers";
import { Toast } from "../Lib/Toast";
import type { DeliveryOption } from "../Models/DeliveryOption";
import type { Product, ProductCategory } from "../Models/Product";
import {
    AddDeliveryOption,
    DeleteDeliveryOption,
    GetDeliveryOptions,
    UpdateDeliveryOption,
} from "../Services/DeliveryOptionServices";
import {
    AddProduct,
    DeleteProduct,
    GetCategories,
    GetProducts,
    UpdateProduct,
} from "../Services/ProductServices";

/**
 * Catalog administration. Everything the floor can sell is defined here: products, the sizes and
 * configurations they come in, their prices, and which delivery services each one offers.
 */
const CatalogPage = () => {
    const { user } = useAuth();

    const [products, setProducts] = useState<Product[]>([]);
    const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>([]);
    const [categories, setCategories] = useState<ProductCategory[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    const [tab, setTab] = useState<ProductCategory | "All" | "Delivery">("Mattress");
    const [search, setSearch] = useState<string>("");
    const [editing, setEditing] = useState<Product | null>(null);
    const [deleting, setDeleting] = useState<Product | null>(null);

    const load = async () => {
        setLoading(true);
        const [catalog, options, cats] = await Promise.all([
            GetProducts(true),
            GetDeliveryOptions(true),
            GetCategories(),
        ]);
        setProducts(catalog);
        setDeliveryOptions(options);
        setCategories(cats);
        setLoading(false);
    };

    useEffect(() => {
        load();
    }, []);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return products.filter((product) => {
            if (tab !== "All" && tab !== "Delivery" && product.category !== tab) return false;
            if (!term) return true;
            return (
                (product.name ?? "").toLowerCase().includes(term) ||
                (product.brand ?? "").toLowerCase().includes(term)
            );
        });
    }, [products, tab, search]);

    if (!user) return <Navigate to="/unauthorized" replace />;

    const handleSaveProduct = async (product: Product) => {
        const saved = product.id ? await UpdateProduct(product) : await AddProduct(product);
        if (!saved) return;

        Toast.Success(`${saved.name} saved.`);
        await load();
    };

    const handleDeleteProduct = async () => {
        if (!deleting?.id) return;

        const success = await DeleteProduct(deleting.id);
        setDeleting(null);

        if (success) {
            Toast.Success("Product removed.");
            await load();
        }
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
        if (await DeleteDeliveryOption(id)) {
            Toast.Success("Delivery option removed.");
            await load();
        }
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
                {tab !== "Delivery" && (
                    <Button
                        text="New product"
                        icon="fa-solid fa-plus"
                        onClick={() =>
                            setEditing({
                                category: tab === "All" ? "Misc" : (tab as ProductCategory),
                                isActive: true,
                                variants: [],
                                deliveryOptions: [],
                            })
                        }
                        className="bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                    />
                )}
            </div>

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
            </div>

            {tab === "Delivery" ? (
                <DeliveryOptionList
                    options={deliveryOptions}
                    onSave={handleSaveDeliveryOption}
                    onDelete={handleDeleteDeliveryOption}
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

                    <ul className="space-y-2">
                        {filtered.map((product) => (
                            <li
                                key={product.id}
                                className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 shadow-sm dark:bg-zinc-800"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold">
                                        {product.name}
                                        {!product.isActive && (
                                            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                                                Archived
                                            </span>
                                        )}
                                    </p>
                                    <p className="flex flex-wrap gap-x-2 text-xs text-zinc-500 dark:text-zinc-400">
                                        <span>{product.brand}</span>
                                        <span>{product.variants?.length ?? 0} sizes</span>
                                        <span>{priceRange(product)}</span>
                                        <span>
                                            {product.deliveryOptions?.length ?? 0} delivery option
                                            {(product.deliveryOptions?.length ?? 0) === 1 ? "" : "s"}
                                        </span>
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
                    categories={categories}
                    deliveryOptions={deliveryOptions.filter((o) => o.isActive)}
                    onSave={handleSaveProduct}
                    onClose={() => setEditing(null)}
                />
            )}

            {deleting && (
                <ConfirmationModal
                    title="Delete product"
                    message={`Delete "${deleting.name}"? If it has already been sold it will be archived instead, so past receipts keep working.`}
                    confirmText="Delete"
                    destructive
                    onConfirm={handleDeleteProduct}
                    onCancel={() => setDeleting(null)}
                />
            )}
        </div>
    );
};

export default CatalogPage;
