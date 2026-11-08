import { useMemo, useState } from "react";
import { Toast } from "@host";
import {
    IncludedPresetPicks,
    IncludedWithChoices,
    MissingPick,
    NotKeptAtCart,
    PickDelivery,
    PresetPicks,
    ToLineChoices,
    type Picks,
} from "../Lib/AddItem";
import { CategoryShortNames, NeedsPrice } from "../Lib/Catalog";
import { ParseMoney } from "../Lib/Format";
import { TakeWithBlocked } from "../Lib/Inventory";
import {
    ApplyDiscount,
    ChoicesPriceChange,
    CleanDiscount,
    CountedOptions,
    DeliverySaleFor,
    SaleFor,
    SizeTracked,
    StockFor,
} from "../Lib/Pricing";
import { SortProducts, type ProductSortKey } from "../Lib/ProductSort";
import type { OrderLine } from "../Models/OrderLine";
import type { Product, ProductCategory } from "../Models/Product";
import type { ProductOption } from "../Models/ProductOption";
import type { ProductVariant } from "../Models/ProductVariant";

/** A category tab in the picker, or every product. */
export type CategoryTab = ProductCategory | "All";

/** The rep's own discount: a percent, or a fixed amount off each item. */
export type DiscountMode = "percent" | "amount";

/**
 * The floor's add-to-order flow: pick a category, pick a product, pick a size, its choices and a
 * delivery method, then add - or describe something not in the catalog. Works the price out the
 * way the server does: choices add to the size's price, the catalog sale comes off, then the
 * rep's own discount comes off the sale price.
 * @param products The catalog.
 * @param onAdd Adds the line to the order.
 * @param onClose Closes the picker once the line is added.
 * @returns The picker's state and handlers.
 */
export const useAddItem = (
    products: Product[],
    onAdd: (line: OrderLine) => Promise<void>,
    onClose: () => void
) => {
    const [tab, setTab] = useState<CategoryTab>("Mattress");
    const [search, setSearch] = useState<string>("");
    const [sortKey, setSortKey] = useState<ProductSortKey>("name-asc");
    const [selected, setSelected] = useState<Product | null>(null);
    const [variantId, setVariantId] = useState<number | null>(null);
    const [deliveryId, setDeliveryId] = useState<number | null>(null);
    const [quantity, setQuantity] = useState<number>(1);
    const [discount, setDiscount] = useState<string>("");
    const [discountMode, setDiscountMode] = useState<DiscountMode>("percent");
    const [picks, setPicks] = useState<Picks>({});
    // Choices for the items a bundle includes, by the included size's id.
    const [includedPicks, setIncludedPicks] = useState<Record<number, Picks>>({});
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
        return (Object.keys(CategoryShortNames) as ProductCategory[]).filter((c) => present.has(c));
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
        return SortProducts(matches, sortKey, Object.keys(CategoryShortNames));
    }, [products, tab, search, sortKey]);

    const variant: ProductVariant | undefined = selected?.variants?.find((v) => v.id === variantId);
    const needsPrice = variant ? NeedsPrice(variant) : false;
    const basePrice = needsPrice ? ParseMoney(priceOverride) : (variant?.price ?? null);
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
    /** What the Add button adds: the items at their final price, plus the shipping. */
    const addTotal = (finalPrice ?? 0) * quantity + shipSalePrice;

    const notKeptAt = (product: Product, size: ProductVariant | undefined) =>
        NotKeptAtCart(products, product, size);

    const chooseProduct = (product: Product) => {
        setSelected(product);

        const firstPriced = product.variants?.find((v) => !NeedsPrice(v)) ?? product.variants?.[0];
        const preset = PresetPicks(product);
        setVariantId(firstPriced?.id ?? null);
        setPicks(preset);
        setIncludedPicks(IncludedPresetPicks(products, firstPriced));
        setDeliveryId(
            PickDelivery(
                product,
                StockFor(product, firstPriced, preset),
                1,
                null,
                notKeptAt(product, firstPriced)
            )
        );

        setQuantity(1);
        setDiscount("");
        setDiscountMode("percent");
        setPriceOverride("");
        setItemNotes("");
    };

    // Changing the size, choices or quantity can leave Take With short, so fall back to shipping.
    const chooseVariant = (next: ProductVariant) => {
        setVariantId(next.id ?? null);
        setIncludedPicks((current) => IncludedPresetPicks(products, next, current));
        if (selected)
            setDeliveryId((current) =>
                PickDelivery(
                    selected,
                    StockFor(selected, next, picks),
                    quantity,
                    current,
                    notKeptAt(selected, next)
                )
            );
    };

    const choose = (optionId: number, choiceId: number) => {
        const next = { ...picks, [optionId]: choiceId };
        setPicks(next);
        if (selected)
            setDeliveryId((current) =>
                PickDelivery(
                    selected,
                    StockFor(selected, variant, next),
                    quantity,
                    current,
                    notKeptAt(selected, variant)
                )
            );
    };

    const changeQuantity = (next: number) => {
        setQuantity(next);
        if (selected)
            setDeliveryId((current) =>
                PickDelivery(
                    selected,
                    StockFor(selected, variant, picks),
                    next,
                    current,
                    notKeptAt(selected, variant)
                )
            );
    };

    /**
     * Stock for one of the selected product's choices, were it picked; null when not counted.
     * @param option The selection.
     * @param choiceId The choice.
     */
    const stockForChoice = (option: ProductOption, choiceId: number): number | null =>
        selected && option.tracksStock && SizeTracked(selected, variant)
            ? StockFor(selected, variant, { ...picks, [option.id ?? 0]: choiceId })
            : null;

    /**
     * Picks a choice for an item the bundle includes.
     * @param includedVariantId The included size's id.
     * @param optionId The selection.
     * @param choiceId The choice.
     */
    const chooseIncluded = (includedVariantId: number, optionId: number, choiceId: number) =>
        setIncludedPicks((all) => ({
            ...all,
            [includedVariantId]: { ...(all[includedVariantId] ?? {}), [optionId]: choiceId },
        }));

    /**
     * Stock for one of an included item's choices, were it picked; null when not counted.
     * @param product The included product.
     * @param includedVariantId The included size's id.
     * @param option The selection.
     * @param choiceId The choice.
     */
    const includedStockForChoice = (
        product: Product,
        includedVariantId: number,
        option: ProductOption,
        choiceId: number
    ): number | null => {
        const size = product.variants?.find((v) => v.id === includedVariantId);
        return option.tracksStock && SizeTracked(product, size)
            ? StockFor(product, size, {
                  ...(includedPicks[includedVariantId] ?? {}),
                  [option.id ?? 0]: choiceId,
              })
            : null;
    };

    // Stock for the exact choices picked; null while a counted selection is still unpicked.
    const onHand = selected ? StockFor(selected, variant, picks) : null;
    const countedUnpicked =
        selected &&
        SizeTracked(selected, variant) &&
        CountedOptions(selected).some((o) => picks[o.id ?? 0] === undefined);
    // Not kept at the cart comes first: picking a color wouldn't make it a Take With.
    const takeWithBlock =
        selected && notKeptAt(selected, variant)
            ? TakeWithBlocked(onHand, quantity, true)
            : countedUnpicked
              ? `Pick the ${CountedOptions(selected!)
                    .filter((o) => picks[o.id ?? 0] === undefined)
                    .map((o) => (o.name ?? "").toLowerCase())
                    .join(" and ")} first`
              : TakeWithBlocked(onHand, quantity);

    const includedWithChoices = IncludedWithChoices(products, variant);

    const back = () => {
        setSelected(null);
        setVariantId(null);
        setDeliveryId(null);
    };

    const handleAddCatalogItem = async () => {
        if (!variant?.id) return void Toast.Warning("Pick a size first.");

        const delivery = selected?.deliveryOptions?.find((d) => d.deliveryOptionId === deliveryId);
        if (delivery?.isTakeWith && takeWithBlock)
            return void Toast.Warning(
                `${takeWithBlock} for Take With. Pick a shipping method instead.`
            );

        if (needsPrice && (basePrice === null || basePrice <= 0))
            return void Toast.Warning("This size has no price on file. Enter one to continue.");

        const missing = MissingPick(selected?.options, picks);
        if (missing)
            return void Toast.Warning(`Pick a ${(missing.name ?? "choice").toLowerCase()} first.`);

        for (const { component, product } of includedWithChoices) {
            const absent = MissingPick(
                product.options,
                includedPicks[component.componentVariantId ?? 0] ?? {}
            );
            if (absent)
                return void Toast.Warning(
                    `Pick a ${(absent.name ?? "choice").toLowerCase()} for the included ${product.name}.`
                );
        }

        const discountValue = ParseMoney(discount);
        if (discount.trim() !== "" && (discountValue === null || discountValue < 0))
            return void Toast.Warning("Enter the discount as a number.");
        if (discountMode === "percent" && (discountValue ?? 0) > 100)
            return void Toast.Warning("The discount must be between 0 and 100 percent.");

        setSaving(true);
        await onAdd({
            lineType: "Product",
            productVariantId: variant.id,
            quantity,
            discountPercent: discountMode === "percent" ? (discountValue ?? undefined) : undefined,
            discountAmount: discountMode === "amount" ? (discountValue ?? undefined) : undefined,
            unitPrice: needsPrice ? (basePrice ?? undefined) : undefined,
            choices: ToLineChoices(picks),
            includedChoices: includedWithChoices.map(({ component }) => ({
                componentVariantId: component.componentVariantId,
                choices: ToLineChoices(includedPicks[component.componentVariantId ?? 0] ?? {}),
            })),
            deliveryOptionId: deliveryId ?? undefined,
            notes: itemNotes.trim() || undefined,
        });
        setSaving(false);
        onClose();
    };

    const handleAddCustomItem = async () => {
        if (!customDescription.trim()) return void Toast.Warning("Describe the item.");

        const price = ParseMoney(customPrice);
        if (price === null || price < 0) return void Toast.Warning("Enter a price for the item.");

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

    return {
        // The product list
        tab,
        setTab,
        search,
        setSearch,
        sortKey,
        setSortKey,
        categories,
        filtered,
        chooseProduct,
        // The product picked
        selected,
        variant,
        variantId,
        chooseVariant,
        picks,
        choose,
        stockForChoice,
        includedWithChoices,
        includedPicks,
        chooseIncluded,
        includedStockForChoice,
        deliveryId,
        setDeliveryId,
        takeWithBlock,
        quantity,
        setQuantity,
        changeQuantity,
        discount,
        setDiscount,
        discountMode,
        setDiscountMode,
        priceOverride,
        setPriceOverride,
        itemNotes,
        setItemNotes,
        // The price
        needsPrice,
        choicesChange,
        listPrice,
        sale,
        salePrice,
        repDiscount,
        finalPrice,
        shipping,
        shipList,
        shipSale,
        shipSalePrice,
        addTotal,
        back,
        handleAddCatalogItem,
        // Something not in the catalog
        customMode,
        setCustomMode,
        customDescription,
        setCustomDescription,
        customBrand,
        setCustomBrand,
        customSize,
        setCustomSize,
        customPrice,
        setCustomPrice,
        handleAddCustomItem,
        saving,
    };
};
