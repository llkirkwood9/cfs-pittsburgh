import { useState } from "react";
import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import Modal from "../Elements/Modal";
import SizeGuideModal from "../Elements/SizeGuideModal";
import TabButton from "../Elements/TabButton";
import TextArea from "../Elements/TextArea";
import TextField from "../Elements/TextField";
import { useAddItem } from "@shared/Hooks/useAddItem";
import { IncludesText, ProductStock, SizeStockText } from "@shared/Lib/AddItem";
import { NeedsPrice, VariantLabel } from "@shared/Lib/Catalog";
import { FormatCurrency } from "@shared/Lib/Format";
import { WarrantyText } from "@shared/Lib/Orders";
import {
    PreviewPrice,
    DeliverySaleFor,
    DiscountText,
    HasDiscount,
    OnSale,
    SaleFor,
} from "@shared/Lib/Pricing";
import { LowestPrice, ProductSortOptions } from "@shared/Lib/ProductSort";
import type { OrderLine } from "@shared/Models/OrderLine";
import type { Product } from "@shared/Models/Product";
import ChoicePicker from "./ChoicePicker";
import { Limits } from "@shared/Lib/Limits";

type Props = {
    products: Product[];
    onAdd: (line: OrderLine) => Promise<void>;
    onClose: () => void;
};

/**
 * The floor's add-to-order flow: pick a category, pick a product, pick a size, pick a delivery
 * method, then add. Everything is a chip rather than a dropdown so it works with a thumb.
 */
const AddItemModal = ({ products, onAdd, onClose }: Props) => {
    const [showSizes, setShowSizes] = useState<boolean>(false);
    const {
        tab,
        setTab,
        search,
        setSearch,
        sortKey,
        setSortKey,
        categories,
        filtered,
        chooseProduct,
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
    } = useAddItem(products, onAdd, onClose);

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
                            text={`Add ${FormatCurrency(addTotal)}`}
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
                                text={category}
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
                                {ProductStock(product) !== null && (
                                    <span className="mt-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                                        {ProductStock(product)} in stock
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
                        maxLength={Limits.lineDescription}
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
                        maxLength={Limits.lineNotes}
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
                    {WarrantyText(selected) && (
                        <p className="flex items-center gap-2 text-sm font-medium text-sky-800 dark:text-sky-300">
                            <Icon icon="fa-solid fa-shield-halved" /> {WarrantyText(selected)}
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
                                                        PreviewPrice(
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
                                    {SizeStockText(selected, v) && (
                                        <span className="text-[11px] font-semibold opacity-90">
                                            {SizeStockText(selected, v)}
                                        </span>
                                    )}
                                    {(v.components ?? []).length > 0 && (
                                        <span className="mt-0.5 text-[11px] font-medium opacity-90">
                                            + {IncludesText(v)}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* The picked size's own note, such as a longer wait for a special order. */}
                    {variant?.notes && (
                        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                            <Icon icon="fa-solid fa-circle-info" /> {variant.notes}
                        </p>
                    )}

                    {(selected.options ?? [])
                        .filter((o) => (o.choices ?? []).length > 0)
                        .map((option) => (
                            <ChoicePicker
                                key={option.id}
                                option={option}
                                picked={picks[option.id ?? 0]}
                                onPick={(choiceId) => choose(option.id ?? 0, choiceId)}
                                stockFor={(choiceId) => stockForChoice(option, choiceId)}
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
                                    return (
                                        <ChoicePicker
                                            key={option.id}
                                            option={option}
                                            picked={includedPicks[id]?.[option.id ?? 0]}
                                            onPick={(choiceId) =>
                                                chooseIncluded(id, option.id ?? 0, choiceId)
                                            }
                                            stockFor={(choiceId) =>
                                                includedStockForChoice(
                                                    product,
                                                    id,
                                                    option,
                                                    choiceId
                                                )
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
                                                            PreviewPrice(
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
                                        text-zinc-900 outline-hidden focus:border-sky-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
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
                        placeholder="ex. Floor model"
                        maxLength={Limits.lineNotes}
                    />
                </div>
            )}

            {showSizes && <SizeGuideModal onClose={() => setShowSizes(false)} />}
        </Modal>
    );
};

export default AddItemModal;
