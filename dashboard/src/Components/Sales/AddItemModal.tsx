import { useMemo, useState } from "react";
import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import Modal from "../Elements/Modal";
import TabButton from "../Elements/TabButton";
import TextField from "../Elements/TextField";
import {
    FormatCurrency,
    NeedsPrice,
    ParseMoney,
    TakeWithBlocked,
    VariantLabel,
} from "../../Lib/ModelHelpers";
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

type SortKey = "name-asc" | "name-desc" | "price-asc" | "price-desc" | "brand";

const sortOptions: { key: SortKey; label: string }[] = [
    { key: "name-asc", label: "Name A-Z" },
    { key: "name-desc", label: "Name Z-A" },
    { key: "price-asc", label: "Price low-high" },
    { key: "price-desc", label: "Price high-low" },
    { key: "brand", label: "Brand" },
];

/** Natural, case-insensitive ordering, so "Agility 3000" sorts before "Agility 5000". */
const byText = (a?: string | null, b?: string | null) =>
    (a ?? "").localeCompare(b ?? "", undefined, { numeric: true, sensitivity: "base" });

/**
 * The cheapest priced size of a product, used for price sorting and the "from" label. Null when
 * every size is Inquire.
 * @param product The product.
 * @returns The lowest price, or null.
 */
const lowestPrice = (product: Product): number | null => {
    const prices = (product.variants ?? [])
        .map((v) => v.price)
        .filter((price): price is number => price !== null && price !== undefined);
    return prices.length ? Math.min(...prices) : null;
};

/**
 * Units on hand for a size, or null when the product does not track inventory.
 * @param product The product.
 * @param variant The size.
 * @returns The count, or null.
 */
const stockFor = (product: Product, variant?: ProductVariant): number | null =>
    product.trackInventory ? (variant?.quantityOnHand ?? 0) : null;

/**
 * The delivery option to preselect: the current choice when it still works, otherwise the
 * product's default, otherwise the first option - skipping Take With when the size is short.
 * @param product The product.
 * @param variant The chosen size.
 * @param quantity Units being added.
 * @param currentId The option picked so far, if any.
 * @returns The delivery option id, or null.
 */
const pickDelivery = (
    product: Product,
    variant: ProductVariant | undefined,
    quantity: number,
    currentId: number | null
): number | null => {
    const blocked = TakeWithBlocked(stockFor(product, variant), quantity);
    const usable = (product.deliveryOptions ?? []).filter((d) => !(d.isTakeWith && blocked));

    if (currentId !== null && usable.some((d) => d.deliveryOptionId === currentId)) return currentId;

    const preferred = usable.find((d) => d.isDefault) ?? usable[0];
    return preferred?.deliveryOptionId ?? null;
};

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
    const [sortKey, setSortKey] = useState<SortKey>("name-asc");
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
        const matches = products.filter((product) => {
            if (tab !== "All" && product.category !== tab) return false;
            if (!term) return true;
            return (
                (product.name ?? "").toLowerCase().includes(term) ||
                (product.brand ?? "").toLowerCase().includes(term)
            );
        });

        // Categories stay grouped - in the All tab each category is sorted on its own, in the same
        // order as the tabs - and the chosen sort applies within each one.
        const categoryOrder = Object.keys(categoryLabels) as ProductCategory[];
        const categoryRank = (p: Product) => categoryOrder.indexOf(p.category ?? "Misc");

        const compare = (a: Product, b: Product): number => {
            switch (sortKey) {
                case "name-desc":
                    return byText(b.name, a.name);
                case "price-asc":
                case "price-desc": {
                    const pa = lowestPrice(a);
                    const pb = lowestPrice(b);
                    // Inquire-only products have no price to sort by, so they go last either way.
                    if (pa === null || pb === null)
                        return pa === pb ? byText(a.name, b.name) : pa === null ? 1 : -1;
                    const diff = sortKey === "price-asc" ? pa - pb : pb - pa;
                    return diff !== 0 ? diff : byText(a.name, b.name);
                }
                case "brand":
                    return byText(a.brand, b.brand) || byText(a.name, b.name);
                default:
                    return byText(a.name, b.name);
            }
        };

        return [...matches].sort((a, b) => categoryRank(a) - categoryRank(b) || compare(a, b));
    }, [products, tab, search, sortKey]);

    const variant: ProductVariant | undefined = selected?.variants?.find((v) => v.id === variantId);
    const needsPrice = variant ? NeedsPrice(variant) : false;
    const effectivePrice = needsPrice ? ParseMoney(priceOverride) : (variant?.price ?? null);

    const chooseProduct = (product: Product) => {
        setSelected(product);

        const firstPriced = product.variants?.find((v) => !NeedsPrice(v)) ?? product.variants?.[0];
        setVariantId(firstPriced?.id ?? null);
        setDeliveryId(pickDelivery(product, firstPriced, 1, null));

        setQuantity(1);
        setDiscount("");
        setPriceOverride("");
    };

    // Changing the size or quantity can leave Take With short, so fall back to shipping.
    const chooseVariant = (next: ProductVariant) => {
        setVariantId(next.id ?? null);
        if (selected) setDeliveryId((current) => pickDelivery(selected, next, quantity, current));
    };

    const changeQuantity = (next: number) => {
        setQuantity(next);
        if (selected) setDeliveryId((current) => pickDelivery(selected, variant, next, current));
    };

    const onHand = selected ? stockFor(selected, variant) : null;
    const takeWithBlock = TakeWithBlocked(onHand, quantity);

    const back = () => {
        setSelected(null);
        setVariantId(null);
        setDeliveryId(null);
    };

    const handleAddCatalogItem = async () => {
        if (!variant?.id) return Toast.Warning("Pick a size first.");

        const delivery = selected?.deliveryOptions?.find((d) => d.deliveryOptionId === deliveryId);
        if (delivery?.isTakeWith && takeWithBlock)
            return Toast.Warning(`${takeWithBlock} for Take With. Pick a shipping method instead.`);

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

                    <div className="-mx-1 mb-3 flex items-center gap-2 overflow-x-auto px-1 pb-1">
                        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Sort
                        </span>
                        {sortOptions.map((option) => (
                            <TabButton
                                key={option.key}
                                text={option.label}
                                active={sortKey === option.key}
                                onClick={() => setSortKey(option.key)}
                            />
                        ))}
                    </div>

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
                                    {lowestPrice(product) !== null &&
                                        ` - from ${FormatCurrency(lowestPrice(product))}`}
                                    {product.notes ? ` - ${product.notes}` : ""}
                                </span>
                                {product.trackInventory && (
                                    <span className="mt-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                                        {(product.variants ?? []).reduce(
                                            (sum, v) => sum + Math.max(0, v.quantityOnHand ?? 0),
                                            0
                                        )}{" "}
                                        in stock
                                    </span>
                                )}
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
                                    onClick={() => chooseVariant(v)}
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
                                    {selected.trackInventory && (
                                        <span className="text-[11px] font-semibold opacity-90">
                                            {(v.quantityOnHand ?? 0) > 0
                                                ? `${v.quantityOnHand} in stock`
                                                : "Out of stock - ship only"}
                                        </span>
                                    )}
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
                                {(selected.deliveryOptions ?? []).map((option) => {
                                    const blocked = option.isTakeWith ? takeWithBlock : null;

                                    return (
                                        <button
                                            key={option.deliveryOptionId}
                                            type="button"
                                            disabled={Boolean(blocked)}
                                            title={blocked ?? undefined}
                                            onClick={() =>
                                                setDeliveryId(option.deliveryOptionId ?? null)
                                            }
                                            className={`min-h-[48px] rounded-xl px-4 text-sm font-semibold transition-colors
                                                disabled:cursor-not-allowed disabled:opacity-50 ${
                                                    option.deliveryOptionId === deliveryId
                                                        ? "bg-sky-700 text-white dark:bg-sky-600"
                                                        : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                                                }`}
                                        >
                                            {option.name}
                                            {(option.price ?? 0) > 0 &&
                                                ` +${FormatCurrency(option.price)}`}
                                            {blocked && (
                                                <span className="block text-[11px] font-medium">
                                                    {blocked}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
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
                                    onClick={() => changeQuantity(Math.max(1, quantity - 1))}
                                    className="bg-zinc-500 px-4 hover:bg-zinc-600"
                                />
                                <span className="min-w-[3ch] text-center text-xl font-bold tabular-nums">
                                    {quantity}
                                </span>
                                <Button
                                    icon="fa-solid fa-plus"
                                    onClick={() => changeQuantity(quantity + 1)}
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
