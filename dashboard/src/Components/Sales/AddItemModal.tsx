import { useMemo, useState } from "react";
import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import Modal from "../Elements/Modal";
import TabButton from "../Elements/TabButton";
import TextField from "../Elements/TextField";
import { FormatCurrency, NeedsPrice, ParseMoney, VariantLabel } from "../../Lib/ModelHelpers";
import { Toast } from "../../Lib/Toast";
import type { OrderLine } from "../../Models/OrderLine";
import type { Product, ProductCategory } from "../../Models/Product";
import type { ProductVariant } from "../../Models/ProductVariant";

type Props = {
    products: Product[];
    onAdd: (line: OrderLine) => Promise<void>;
    onClose: () => void;
};

type CategoryTab = ProductCategory | "All";

const categoryLabels: Record<ProductCategory, string> = {
    Mattress: "Mattresses",
    AdjustableBase: "Bases",
    Pillow: "Pillows",
    Sheets: "Sheets",
    MattressProtector: "Protectors",
    Frame: "Frames",
    BeanBagChair: "Bean Bags",
    Misc: "Other",
};

/**
 * The floor's add-to-order flow: pick a category, pick a product, pick a size, pick a delivery
 * method, then add. Everything is a chip rather than a dropdown so it works with a thumb.
 */
const AddItemModal = ({ products, onAdd, onClose }: Props) => {
    const [tab, setTab] = useState<CategoryTab>("Mattress");
    const [search, setSearch] = useState<string>("");
    const [selected, setSelected] = useState<Product | null>(null);
    const [variantId, setVariantId] = useState<number | null>(null);
    const [deliveryId, setDeliveryId] = useState<number | null>(null);
    const [quantity, setQuantity] = useState<number>(1);
    const [discount, setDiscount] = useState<string>("");
    const [priceOverride, setPriceOverride] = useState<string>("");
    const [saving, setSaving] = useState<boolean>(false);

    const [customDescription, setCustomDescription] = useState<string>("");
    const [customBrand, setCustomBrand] = useState<string>("");
    const [customSize, setCustomSize] = useState<string>("");
    const [customPrice, setCustomPrice] = useState<string>("");
    const [customMode, setCustomMode] = useState<boolean>(false);

    const categories = useMemo(() => {
        const present = new Set(products.map((p) => p.category).filter(Boolean));
        return (Object.keys(categoryLabels) as ProductCategory[]).filter((c) => present.has(c));
    }, [products]);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return products.filter((product) => {
            if (tab !== "All" && product.category !== tab) return false;
            if (!term) return true;
            return (
                (product.name ?? "").toLowerCase().includes(term) ||
                (product.brand ?? "").toLowerCase().includes(term)
            );
        });
    }, [products, tab, search]);

    const variant: ProductVariant | undefined = selected?.variants?.find((v) => v.id === variantId);
    const needsPrice = variant ? NeedsPrice(variant) : false;
    const effectivePrice = needsPrice ? ParseMoney(priceOverride) : (variant?.price ?? null);

    const chooseProduct = (product: Product) => {
        setSelected(product);

        const firstPriced = product.variants?.find((v) => !NeedsPrice(v)) ?? product.variants?.[0];
        setVariantId(firstPriced?.id ?? null);

        const preferred =
            product.deliveryOptions?.find((d) => d.isDefault) ?? product.deliveryOptions?.[0];
        setDeliveryId(preferred?.deliveryOptionId ?? null);

        setQuantity(1);
        setDiscount("");
        setPriceOverride("");
    };

    const back = () => {
        setSelected(null);
        setVariantId(null);
        setDeliveryId(null);
    };

    const handleAddCatalogItem = async () => {
        if (!variant?.id) return Toast.Warning("Pick a size first.");

        if (needsPrice && (effectivePrice === null || effectivePrice <= 0))
            return Toast.Warning("This size has no price on file. Enter one to continue.");

        const discountPercent = ParseMoney(discount);
        if (discountPercent !== null && (discountPercent < 0 || discountPercent > 100))
            return Toast.Warning("The discount must be between 0 and 100 percent.");

        setSaving(true);
        await onAdd({
            lineType: "Product",
            productVariantId: variant.id,
            quantity,
            discountPercent: discountPercent ?? undefined,
            unitPrice: needsPrice ? (effectivePrice ?? undefined) : undefined,
            deliveryOptionId: deliveryId ?? undefined,
        });
        setSaving(false);
        onClose();
    };

    const handleAddCustomItem = async () => {
        if (!customDescription.trim()) return Toast.Warning("Describe the item.");

        const price = ParseMoney(customPrice);
        if (price === null || price < 0) return Toast.Warning("Enter a price for the item.");

        setSaving(true);
        await onAdd({
            lineType: "Custom",
            category: "Misc",
            description: customDescription.trim(),
            brand: customBrand.trim() || undefined,
            size: customSize.trim() || undefined,
            unitPrice: price,
            quantity,
        });
        setSaving(false);
        onClose();
    };

    return (
        <Modal
            title={selected ? `${selected.brand ?? ""} ${selected.name ?? ""}`.trim() : "Add item"}
            onClose={onClose}
            wide
            footer={
                selected ? (
                    <>
                        <Button
                            text="Back"
                            icon="fa-solid fa-arrow-left"
                            onClick={back}
                            className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                        />
                        <Button
                            text={`Add ${FormatCurrency((effectivePrice ?? 0) * quantity * (1 - (ParseMoney(discount) ?? 0) / 100))}`}
                            icon="fa-solid fa-plus"
                            onClick={handleAddCatalogItem}
                            loading={saving}
                            className="bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                        />
                    </>
                ) : customMode ? (
                    <>
                        <Button
                            text="Back"
                            icon="fa-solid fa-arrow-left"
                            onClick={() => setCustomMode(false)}
                            className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                        />
                        <Button
                            text="Add item"
                            icon="fa-solid fa-plus"
                            onClick={handleAddCustomItem}
                            loading={saving}
                            className="bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                        />
                    </>
                ) : undefined
            }
        >
            {!selected && !customMode && (
                <>
                    <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
                        <TabButton
                            text="All"
                            active={tab === "All"}
                            onClick={() => setTab("All")}
                        />
                        {categories.map((category) => (
                            <TabButton
                                key={category}
                                text={categoryLabels[category]}
                                active={tab === category}
                                onClick={() => setTab(category)}
                            />
                        ))}
                    </div>

                    <TextField
                        label="Search"
                        value={search}
                        onChange={setSearch}
                        placeholder="Model or brand"
                        className="mb-3"
                    />

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {filtered.map((product) => (
                            <button
                                key={product.id}
                                type="button"
                                onClick={() => chooseProduct(product)}
                                className="flex min-h-[64px] flex-col items-start justify-center rounded-xl
                                    bg-zinc-100 px-4 py-3 text-left transition-colors
                                    hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                            >
                                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                                    {product.name}
                                </span>
                                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {product.brand}
                                    {product.notes ? ` - ${product.notes}` : ""}
                                </span>
                            </button>
                        ))}

                        {filtered.length === 0 && (
                            <p className="col-span-full py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                                Nothing matches that search.
                            </p>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => setCustomMode(true)}
                        className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl
                            border-2 border-dashed border-zinc-300 text-sm font-semibold text-zinc-600
                            hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                        <Icon icon="fa-solid fa-pen" />
                        Something not in the catalog
                    </button>
                </>
            )}

            {customMode && !selected && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <TextField
                        label="Description"
                        value={customDescription}
                        onChange={setCustomDescription}
                        placeholder="What is it?"
                        className="sm:col-span-2"
                        maxLength={300}
                        autoFocus
                    />
                    <TextField label="Brand" value={customBrand} onChange={setCustomBrand} />
                    <TextField label="Size" value={customSize} onChange={setCustomSize} />
                    <TextField
                        label="Price"
                        value={customPrice}
                        onChange={setCustomPrice}
                        inputMode="decimal"
                        placeholder="0.00"
                    />
                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Quantity
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                icon="fa-solid fa-minus"
                                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                                className="bg-zinc-500 px-4 hover:bg-zinc-600"
                            />
                            <span className="min-w-[3ch] text-center text-xl font-bold tabular-nums">
                                {quantity}
                            </span>
                            <Button
                                icon="fa-solid fa-plus"
                                onClick={() => setQuantity((q) => q + 1)}
                                className="bg-zinc-500 px-4 hover:bg-zinc-600"
                            />
                        </div>
                    </label>
                </div>
            )}

            {selected && (
                <div className="space-y-4">
                    {selected.notes && (
                        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                            <Icon icon="fa-solid fa-circle-info" /> {selected.notes}
                        </p>
                    )}

                    <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Size &amp; configuration
                        </p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {(selected.variants ?? []).map((v) => (
                                <button
                                    key={v.id}
                                    type="button"
                                    onClick={() => setVariantId(v.id ?? null)}
                                    className={`flex min-h-[60px] flex-col items-start justify-center rounded-xl px-3 py-2
                                        text-left transition-colors ${
                                            v.id === variantId
                                                ? "bg-sky-700 text-white dark:bg-sky-600"
                                                : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                                        }`}
                                >
                                    <span className="text-sm font-semibold">{VariantLabel(v)}</span>
                                    <span className="text-xs opacity-80">
                                        {NeedsPrice(v) ? "Inquire" : FormatCurrency(v.price)}
                                    </span>
                                    {(v.components ?? []).length > 0 && (
                                        <span className="mt-0.5 text-[11px] font-medium opacity-90">
                                            +{" "}
                                            {(v.components ?? [])
                                                .map((c) =>
                                                    (c.quantity ?? 1) > 1
                                                        ? `${c.quantity} x ${c.productName}`
                                                        : c.productName
                                                )
                                                .join(", ")}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {needsPrice && (
                        <TextField
                            label="Price (no price on file - enter one)"
                            value={priceOverride}
                            onChange={setPriceOverride}
                            inputMode="decimal"
                            placeholder="0.00"
                        />
                    )}

                    {(selected.deliveryOptions ?? []).length > 0 && (
                        <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                Shipping
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {(selected.deliveryOptions ?? []).map((option) => (
                                    <button
                                        key={option.deliveryOptionId}
                                        type="button"
                                        onClick={() =>
                                            setDeliveryId(option.deliveryOptionId ?? null)
                                        }
                                        className={`min-h-[48px] rounded-xl px-4 text-sm font-semibold transition-colors ${
                                            option.deliveryOptionId === deliveryId
                                                ? "bg-sky-700 text-white dark:bg-sky-600"
                                                : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                                        }`}
                                    >
                                        {option.name}
                                        {(option.price ?? 0) > 0 &&
                                            ` +${FormatCurrency(option.price)}`}
                                    </button>
                                ))}
                            </div>
                            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                                Need a second service, such as White Glove plus Haul Away? Add the
                                item, then use Add service on the line.
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                Quantity
                            </span>
                            <div className="flex items-center gap-2">
                                <Button
                                    icon="fa-solid fa-minus"
                                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                                    className="bg-zinc-500 px-4 hover:bg-zinc-600"
                                />
                                <span className="min-w-[3ch] text-center text-xl font-bold tabular-nums">
                                    {quantity}
                                </span>
                                <Button
                                    icon="fa-solid fa-plus"
                                    onClick={() => setQuantity((q) => q + 1)}
                                    className="bg-zinc-500 px-4 hover:bg-zinc-600"
                                />
                            </div>
                        </label>

                        <TextField
                            label="Discount %"
                            value={discount}
                            onChange={setDiscount}
                            inputMode="decimal"
                            placeholder="0"
                        />
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default AddItemModal;
