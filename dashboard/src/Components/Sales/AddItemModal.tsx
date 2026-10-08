import { useMemo, useState } from "react";
import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import Modal from "../Elements/Modal";
import SizeGuideModal from "../Elements/SizeGuideModal";
import TabButton from "../Elements/TabButton";
import TextArea from "../Elements/TextArea";
import TextField from "../Elements/TextField";
import {
    FormatCurrency,
    NeedsPrice,
    ParseMoney,
    TakeWithBlocked,
    VariantLabel,
} from "../../Lib/ModelHelpers";
import {
    ApplyDiscount,
    ChoicesPriceChange,
    CleanDiscount,
    CountedOptions,
    DeliverySaleFor,
    DiscountText,
    HasDiscount,
    OnSale,
    SaleFor,
    SizeTracked,
    StockFor,
} from "../../Lib/Pricing";
import {
    LowestPrice,
    ProductSortOptions,
    SortProducts,
    type ProductSortKey,
} from "../../Lib/ProductSort";
import { Toast } from "../../Lib/Toast";
import type { OrderLine } from "../../Models/OrderLine";
import type { Product, ProductCategory } from "../../Models/Product";
import type { LineChoice, ProductOption } from "../../Models/ProductOption";
import type { ProductVariant } from "../../Models/ProductVariant";
import ChoicePicker from "./ChoicePicker";

type Props = {
    products: Product[];
    onAdd: (line: OrderLine) => Promise<void>;
    onClose: () => void;
};

type CategoryTab = ProductCategory | "All";

/**
 * Units on hand for a size across all its choices, or null when the size isn't tracked (the
 * product does not track inventory, or the size is left out). Used for the "in stock" labels;
 * Take With checks the exact choices.
 * @param product The product.
 * @param variant The size.
 * @returns The count, or null.
 */
const sizeStock = (product: Product, variant?: ProductVariant): number | null => {
    if (!SizeTracked(product, variant)) return null;
    if (variant?.stocks)
        return variant.stocks.reduce((sum, s) => sum + Math.max(0, s.quantityOnHand ?? 0), 0);
    return variant?.quantityOnHand ?? 0;
};

/** Picks preset for a product: any selection with a single choice is chosen already. */
const presetPicks = (product?: Product): Record<number, number> =>
    Object.fromEntries(
        (product?.options ?? [])
            .filter((o) => (o.choices ?? []).length === 1 && o.id && o.choices![0].id)
            .map((o) => [o.id!, o.choices![0].id!])
    );

/** The first required selection without a choice yet, if any. */
const missingPick = (options: ProductOption[] | undefined, picked: Record<number, number>) =>
    (options ?? []).find(
        (o) =>
            (o.isRequired || o.tracksStock) &&
            (o.choices ?? []).length > 0 &&
            picked[o.id ?? 0] === undefined
    );

/** The picks as sent to the server. */
const toLineChoices = (picked: Record<number, number>): LineChoice[] =>
    Object.entries(picked).map(([optionId, choiceId]) => ({
        optionId: Number(optionId),
        choiceId,
    }));

/**
 * The delivery option to preselect: the current choice when it still works, otherwise the
 * product's default, otherwise the first option - skipping Take With when the size is short.
 * @param product The product.
 * @param onHand Units on hand for the chosen size and choices, or null when not tracked.
 * @param quantity Units being added.
 * @param currentId The option picked so far, if any.
 * @returns The delivery option id, or null.
 */
const pickDelivery = (
    product: Product,
    onHand: number | null,
    quantity: number,
    currentId: number | null
): number | null => {
    const blocked = TakeWithBlocked(onHand, quantity);
    const usable = (product.deliveryOptions ?? []).filter((d) => !(d.isTakeWith && blocked));

    if (currentId !== null && usable.some((d) => d.deliveryOptionId === currentId))
        return currentId;

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
    const [sortKey, setSortKey] = useState<ProductSortKey>("name-asc");
    const [showSizes, setShowSizes] = useState<boolean>(false);
    const [selected, setSelected] = useState<Product | null>(null);
    const [variantId, setVariantId] = useState<number | null>(null);
    const [deliveryId, setDeliveryId] = useState<number | null>(null);
    const [quantity, setQuantity] = useState<number>(1);
    const [discount, setDiscount] = useState<string>("");
    const [discountMode, setDiscountMode] = useState<"percent" | "amount">("percent");
    const [picks, setPicks] = useState<Record<number, number>>({});
    // Choices for the items a bundle includes, by the included size's id.
    const [includedPicks, setIncludedPicks] = useState<Record<number, Record<number, number>>>({});
    const [priceOverride, setPriceOverride] = useState<string>("");
    const [itemNotes, setItemNotes] = useState<string>("");
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

        // Categories stay grouped, in the same order as the tabs, with the chosen sort within each.
        return SortProducts(matches, sortKey, Object.keys(categoryLabels));
    }, [products, tab, search, sortKey]);

    const variant: ProductVariant | undefined = selected?.variants?.find((v) => v.id === variantId);
    const needsPrice = variant ? NeedsPrice(variant) : false;
    const basePrice = needsPrice ? ParseMoney(priceOverride) : (variant?.price ?? null);
    // Choices can add to the price; the catalog sale (for a size with a price on file) then comes
    // off, and the rep's own discount comes off the sale price - as the server works it out.
    const choicesChange = selected ? ChoicesPriceChange(selected, picks) : 0;
    const listPrice = basePrice === null ? null : basePrice + choicesChange;
    const sale = selected && variant && !needsPrice ? SaleFor(selected, variant) : CleanDiscount();
    const salePrice = listPrice === null ? null : ApplyDiscount(listPrice, sale);
    const repDiscount =
        discountMode === "percent"
            ? CleanDiscount(ParseMoney(discount), null)
            : CleanDiscount(null, ParseMoney(discount));
    const finalPrice = salePrice === null ? null : ApplyDiscount(salePrice, repDiscount);

    // The shipping picked, with its catalog sale (the product's own, or the option's). A rep's
    // discount on shipping is given afterwards, with Edit on its row.
    const shipping = selected?.deliveryOptions?.find((d) => d.deliveryOptionId === deliveryId);
    const shipList = shipping?.price ?? 0;
    const shipSale = shipping ? DeliverySaleFor(shipping) : CleanDiscount();
    const shipSalePrice = ApplyDiscount(shipList, shipSale);

    // Stock for the exact choices picked; null while a counted selection is still unpicked.
    const stockNow = (
        product: Product,
        size: ProductVariant | undefined,
        picked: Record<number, number>
    ) => StockFor(product, size, picked);

    const chooseProduct = (product: Product) => {
        setSelected(product);

        const firstPriced = product.variants?.find((v) => !NeedsPrice(v)) ?? product.variants?.[0];
        const preset = presetPicks(product);
        setVariantId(firstPriced?.id ?? null);
        setPicks(preset);
        setIncludedPicks(
            Object.fromEntries(
                (firstPriced?.components ?? []).map((c) => [
                    c.componentVariantId ?? 0,
                    presetPicks(products.find((p) => p.id === c.productId)),
                ])
            )
        );
        setDeliveryId(pickDelivery(product, stockNow(product, firstPriced, preset), 1, null));

        setQuantity(1);
        setDiscount("");
        setDiscountMode("percent");
        setPriceOverride("");
        setItemNotes("");
    };

    // Changing the size, choices or quantity can leave Take With short, so fall back to shipping.
    const chooseVariant = (next: ProductVariant) => {
        setVariantId(next.id ?? null);
        setIncludedPicks((current) =>
            Object.fromEntries(
                (next.components ?? []).map((c) => [
                    c.componentVariantId ?? 0,
                    current[c.componentVariantId ?? 0] ??
                        presetPicks(products.find((p) => p.id === c.productId)),
                ])
            )
        );
        if (selected)
            setDeliveryId((current) =>
                pickDelivery(selected, stockNow(selected, next, picks), quantity, current)
            );
    };

    const choose = (optionId: number, choiceId: number) => {
        const next = { ...picks, [optionId]: choiceId };
        setPicks(next);
        if (selected)
            setDeliveryId((current) =>
                pickDelivery(selected, stockNow(selected, variant, next), quantity, current)
            );
    };

    const changeQuantity = (next: number) => {
        setQuantity(next);
        if (selected)
            setDeliveryId((current) =>
                pickDelivery(selected, stockNow(selected, variant, picks), next, current)
            );
    };

    const onHand = selected ? stockNow(selected, variant, picks) : null;
    const countedUnpicked =
        selected &&
        SizeTracked(selected, variant) &&
        CountedOptions(selected).some((o) => picks[o.id ?? 0] === undefined);
    const takeWithBlock = countedUnpicked
        ? `Pick the ${CountedOptions(selected!)
              .filter((o) => picks[o.id ?? 0] === undefined)
              .map((o) => (o.name ?? "").toLowerCase())
              .join(" and ")} first`
        : TakeWithBlocked(onHand, quantity);

    // Included items with selections of their own, such as sheets in a color.
    const includedWithChoices = (variant?.components ?? [])
        .map((c) => ({ component: c, product: products.find((p) => p.id === c.productId) }))
        .filter(
            (x): x is { component: typeof x.component; product: Product } =>
                Boolean(x.product) &&
                (x.product!.options ?? []).some((o) => (o.choices ?? []).length > 0)
        );

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

        if (needsPrice && (basePrice === null || basePrice <= 0))
            return Toast.Warning("This size has no price on file. Enter one to continue.");

        const missing = missingPick(selected?.options, picks);
        if (missing)
            return Toast.Warning(`Pick a ${(missing.name ?? "choice").toLowerCase()} first.`);

        for (const { component, product } of includedWithChoices) {
            const absent = missingPick(
                product.options,
                includedPicks[component.componentVariantId ?? 0] ?? {}
            );
            if (absent)
                return Toast.Warning(
                    `Pick a ${(absent.name ?? "choice").toLowerCase()} for the included ${product.name}.`
                );
        }

        const discountValue = ParseMoney(discount);
        if (discount.trim() !== "" && (discountValue === null || discountValue < 0))
            return Toast.Warning("Enter the discount as a number.");
        if (discountMode === "percent" && (discountValue ?? 0) > 100)
            return Toast.Warning("The discount must be between 0 and 100 percent.");

        setSaving(true);
        await onAdd({
            lineType: "Product",
            productVariantId: variant.id,
            quantity,
            discountPercent: discountMode === "percent" ? (discountValue ?? undefined) : undefined,
            discountAmount: discountMode === "amount" ? (discountValue ?? undefined) : undefined,
            unitPrice: needsPrice ? (basePrice ?? undefined) : undefined,
            choices: toLineChoices(picks),
            includedChoices: includedWithChoices.map(({ component }) => ({
                componentVariantId: component.componentVariantId,
                choices: toLineChoices(includedPicks[component.componentVariantId ?? 0] ?? {}),
            })),
            deliveryOptionId: deliveryId ?? undefined,
            notes: itemNotes.trim() || undefined,
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
            notes: itemNotes.trim() || undefined,
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
                            text={`Add ${FormatCurrency((finalPrice ?? 0) * quantity + shipSalePrice)}`}
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
                        {ProductSortOptions.map((option) => (
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
                                <span className="flex flex-wrap items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100">
                                    {product.name}
                                    {OnSale(product) && (
                                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold uppercase text-rose-800 dark:bg-rose-900/50 dark:text-rose-200">
                                            Sale
                                        </span>
                                    )}
                                </span>
                                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {product.brand}
                                    {LowestPrice(product) !== null &&
                                        ` - from ${FormatCurrency(LowestPrice(product))}`}
                                    {product.notes ? ` - ${product.notes}` : ""}
                                </span>
                                {(product.variants ?? []).some((v) => SizeTracked(product, v)) && (
                                    <span className="mt-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                                        {(product.variants ?? []).reduce(
                                            (sum, v) =>
                                                sum + Math.max(0, sizeStock(product, v) ?? 0),
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
                    <TextArea
                        label="Note (optional)"
                        value={itemNotes}
                        onChange={setItemNotes}
                        placeholder="Printed under the item on the sales sheet"
                        className="sm:col-span-2"
                        maxLength={500}
                    />
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
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                Size &amp; configuration
                            </p>
                            <button
                                type="button"
                                onClick={() => setShowSizes(true)}
                                className="flex min-h-[36px] items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-sky-700 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950/40"
                            >
                                <Icon icon="fa-solid fa-ruler-combined" />
                                Size guide
                            </button>
                        </div>
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
                                        {NeedsPrice(v) ? (
                                            "Inquire"
                                        ) : HasDiscount(SaleFor(selected, v)) ? (
                                            <>
                                                <s>{FormatCurrency(v.price)}</s>{" "}
                                                <span className="font-bold">
                                                    {FormatCurrency(
                                                        ApplyDiscount(
                                                            v.price ?? 0,
                                                            SaleFor(selected, v)
                                                        )
                                                    )}
                                                </span>{" "}
                                                ({DiscountText(SaleFor(selected, v))} off)
                                            </>
                                        ) : (
                                            FormatCurrency(v.price)
                                        )}
                                    </span>
                                    {SizeTracked(selected, v) && (
                                        <span className="text-[11px] font-semibold opacity-90">
                                            {(sizeStock(selected, v) ?? 0) > 0
                                                ? `${sizeStock(selected, v)} in stock${v.stocks ? " in all" : ""}`
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

                    {(selected.options ?? [])
                        .filter((o) => (o.choices ?? []).length > 0)
                        .map((option) => (
                            <ChoicePicker
                                key={option.id}
                                option={option}
                                picked={picks[option.id ?? 0]}
                                onPick={(choiceId) => choose(option.id ?? 0, choiceId)}
                                stockFor={(choiceId) =>
                                    option.tracksStock && SizeTracked(selected, variant)
                                        ? stockNow(selected, variant, {
                                              ...picks,
                                              [option.id ?? 0]: choiceId,
                                          })
                                        : null
                                }
                            />
                        ))}

                    {includedWithChoices.map(({ component, product }) => (
                        <div
                            key={component.componentVariantId}
                            className="rounded-xl border border-violet-200 p-3 dark:border-violet-800"
                        >
                            <p className="mb-2 text-sm font-semibold text-violet-900 dark:text-violet-200">
                                <Icon icon="fa-solid fa-link" /> Included:{" "}
                                {(component.quantity ?? 1) > 1 ? `${component.quantity} x ` : ""}
                                {product.name}
                                {component.size ? ` - ${component.size}` : ""}
                            </p>
                            {(product.options ?? [])
                                .filter((o) => (o.choices ?? []).length > 0)
                                .map((option) => {
                                    const id = component.componentVariantId ?? 0;
                                    const current = includedPicks[id] ?? {};
                                    const size = product.variants?.find((v) => v.id === id);
                                    return (
                                        <ChoicePicker
                                            key={option.id}
                                            option={option}
                                            picked={current[option.id ?? 0]}
                                            onPick={(choiceId) =>
                                                setIncludedPicks((all) => ({
                                                    ...all,
                                                    [id]: {
                                                        ...(all[id] ?? {}),
                                                        [option.id ?? 0]: choiceId,
                                                    },
                                                }))
                                            }
                                            stockFor={(choiceId) =>
                                                option.tracksStock && SizeTracked(product, size)
                                                    ? StockFor(product, size, {
                                                          ...current,
                                                          [option.id ?? 0]: choiceId,
                                                      })
                                                    : null
                                            }
                                            hidePrice
                                        />
                                    );
                                })}
                        </div>
                    ))}

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
                                                (HasDiscount(DeliverySaleFor(option)) ? (
                                                    <>
                                                        {" +"}
                                                        <s className="opacity-70">
                                                            {FormatCurrency(option.price)}
                                                        </s>{" "}
                                                        {FormatCurrency(
                                                            ApplyDiscount(
                                                                option.price ?? 0,
                                                                DeliverySaleFor(option)
                                                            )
                                                        )}
                                                        <span className="block text-[11px] font-medium">
                                                            Sale{" "}
                                                            {DiscountText(DeliverySaleFor(option))}{" "}
                                                            off
                                                        </span>
                                                    </>
                                                ) : (
                                                    ` +${FormatCurrency(option.price)}`
                                                ))}
                                            {blocked && (
                                                <span className="block text-[11px] font-medium">
                                                    {blocked}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                            {shipList > 0 && HasDiscount(shipSale) && (
                                <p className="mt-2 rounded-lg bg-zinc-100 px-3 py-2 text-sm dark:bg-zinc-700">
                                    {shipping?.name} {FormatCurrency(shipList)} - sale{" "}
                                    {DiscountText(shipSale)} off ={" "}
                                    <span className="font-semibold">
                                        {FormatCurrency(shipSalePrice)}
                                    </span>
                                </p>
                            )}
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

                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                {HasDiscount(sale) ? "Extra discount" : "Discount"}
                            </span>
                            <div className="flex gap-2">
                                <div
                                    role="radiogroup"
                                    aria-label="Discount type"
                                    className="inline-flex shrink-0 overflow-hidden rounded-xl border border-zinc-300 dark:border-zinc-600"
                                >
                                    {(["percent", "amount"] as const).map((mode) => (
                                        <button
                                            key={mode}
                                            type="button"
                                            role="radio"
                                            aria-checked={discountMode === mode}
                                            onClick={() => setDiscountMode(mode)}
                                            className={`min-h-[48px] w-11 text-base font-bold ${
                                                discountMode === mode
                                                    ? "bg-sky-700 text-white dark:bg-sky-600"
                                                    : "bg-white text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                                            }`}
                                        >
                                            {mode === "percent" ? "%" : "$"}
                                        </button>
                                    ))}
                                </div>
                                <input
                                    value={discount}
                                    onChange={(e) => setDiscount(e.target.value)}
                                    inputMode="decimal"
                                    placeholder="0"
                                    aria-label={
                                        discountMode === "percent"
                                            ? "Discount percent"
                                            : "Discount amount off each"
                                    }
                                    className="min-h-[48px] w-full min-w-0 rounded-xl border border-zinc-300 bg-white px-3 text-base
                                        text-zinc-900 outline-none focus:border-sky-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                                />
                            </div>
                        </div>
                    </div>

                    {listPrice !== null &&
                        (choicesChange !== 0 || HasDiscount(sale) || HasDiscount(repDiscount)) && (
                            <p className="rounded-lg bg-zinc-100 px-3 py-2 text-sm dark:bg-zinc-700">
                                {FormatCurrency(listPrice)} each
                                {HasDiscount(sale) && (
                                    <>
                                        {" "}
                                        - sale {DiscountText(sale)} off ={" "}
                                        <span className="font-semibold">
                                            {FormatCurrency(salePrice)}
                                        </span>
                                    </>
                                )}
                                {HasDiscount(repDiscount) && (
                                    <>
                                        {" "}
                                        - {DiscountText(repDiscount)} off ={" "}
                                        <span className="font-semibold">
                                            {FormatCurrency(finalPrice)}
                                        </span>
                                    </>
                                )}
                            </p>
                        )}

                    <TextArea
                        label="Note (optional)"
                        value={itemNotes}
                        onChange={setItemNotes}
                        placeholder="e.g. Floor model - small scuff on the corner"
                        maxLength={500}
                    />
                </div>
            )}

            {showSizes && <SizeGuideModal onClose={() => setShowSizes(false)} />}
        </Modal>
    );
};

export default AddItemModal;
