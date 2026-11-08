import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Button from "../Elements/Button";
import DiscountInput from "../Elements/DiscountInput";
import Grid, { Cell } from "../Elements/Grid";
import Icon from "../Elements/Icon";
import Modal from "../Elements/Modal";
import SizeGuideModal from "../Elements/SizeGuideModal";
import Stepper from "../Elements/Stepper";
import TabButton from "../Elements/TabButton";
import Text from "../Elements/Text";
import TextArea from "../Elements/TextArea";
import TextField from "../Elements/TextField";
import { cx } from "../../Lib/ClassNames";
import { useAddItem } from "@shared/Hooks/useAddItem";
import { IncludesText, ProductStock, SizeStockText } from "@shared/Lib/AddItem";
import { CategoryShortNames, NeedsPrice, VariantLabel } from "@shared/Lib/Catalog";
import { FormatCurrency } from "@shared/Lib/Format";
import { WarrantyText } from "@shared/Lib/Orders";
import {
    ApplyDiscount,
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

/** A chip's text colour: white when chosen. */
const chipText = (active: boolean) => (active ? "text-white" : "text-zinc-800 dark:text-zinc-100");

/** A chip's background: sky when chosen. */
const chipBox = (active: boolean) =>
    active
        ? "bg-sky-700 dark:bg-sky-600"
        : "bg-zinc-100 active:bg-zinc-200 dark:bg-zinc-700 dark:active:bg-zinc-600";

/** An uppercase field label. */
const Label = ({ children }: { children: string }) => (
    <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {children}
    </Text>
);

/**
 * The floor's add-to-order flow: pick a category, pick a product, pick a size, pick a delivery
 * method, then add. Everything is a chip rather than a drop-down so it works with a thumb.
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
                            className="bg-zinc-500 dark:bg-zinc-600"
                        />
                        <Button
                            text={`Add ${FormatCurrency(addTotal)}`}
                            icon="fa-solid fa-plus"
                            onClick={handleAddCatalogItem}
                            loading={saving}
                            className="bg-green-700 dark:bg-green-600"
                        />
                    </>
                ) : customMode ? (
                    <>
                        <Button
                            text="Back"
                            icon="fa-solid fa-arrow-left"
                            onClick={() => setCustomMode(false)}
                            className="bg-zinc-500 dark:bg-zinc-600"
                        />
                        <Button
                            text="Add item"
                            icon="fa-solid fa-plus"
                            onClick={handleAddCustomItem}
                            loading={saving}
                            className="bg-green-700 dark:bg-green-600"
                        />
                    </>
                ) : undefined
            }
        >
            {!selected && !customMode && (
                <>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        className="mb-3"
                        contentContainerClassName="gap-2 pb-1"
                    >
                        <TabButton
                            text="All"
                            active={tab === "All"}
                            onClick={() => setTab("All")}
                        />
                        {categories.map((category) => (
                            <TabButton
                                key={category}
                                text={CategoryShortNames[category]}
                                active={tab === category}
                                onClick={() => setTab(category)}
                            />
                        ))}
                    </ScrollView>

                    <TextField
                        label="Search"
                        value={search}
                        onChange={setSearch}
                        placeholder="Model or brand"
                        className="mb-3"
                        autoCapitalize="none"
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

                    <Grid columns={{ base: 1, sm: 2 }} gap={8}>
                        {filtered.map((product) => (
                            <Pressable
                                key={product.id}
                                onPress={() => chooseProduct(product)}
                                accessibilityRole="button"
                                className="min-h-[64px] justify-center rounded-xl bg-zinc-100 px-4 py-3 active:bg-zinc-200 dark:bg-zinc-700 dark:active:bg-zinc-600"
                            >
                                <View className="flex-row flex-wrap items-center gap-2">
                                    <Text className="font-semibold">{product.name}</Text>
                                    {OnSale(product) && (
                                        <View className="rounded-full bg-rose-100 px-2 py-0.5 dark:bg-rose-900/50">
                                            <Text className="text-[11px] font-bold uppercase text-rose-800 dark:text-rose-200">
                                                Sale
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {product.brand}
                                    {LowestPrice(product) !== null &&
                                        ` - from ${FormatCurrency(LowestPrice(product))}`}
                                    {product.notes ? ` - ${product.notes}` : ""}
                                </Text>
                                {ProductStock(product) !== null && (
                                    <Text className="mt-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                                        {ProductStock(product)} in stock
                                    </Text>
                                )}
                            </Pressable>
                        ))}
                    </Grid>

                    {filtered.length === 0 && (
                        <Text className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                            Nothing matches that search.
                        </Text>
                    )}

                    <Pressable
                        onPress={() => setCustomMode(true)}
                        accessibilityRole="button"
                        className="mt-4 min-h-[48px] w-full flex-row items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 active:bg-zinc-100 dark:border-zinc-600 dark:active:bg-zinc-700"
                    >
                        <Icon icon="fa-solid fa-pen" className="text-zinc-600 dark:text-zinc-300" />
                        <Text className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                            Something not in the catalog
                        </Text>
                    </Pressable>
                </>
            )}

            {customMode && !selected && (
                <Grid columns={{ base: 1, sm: 2 }}>
                    <Cell span={2}>
                        <TextField
                            label="Description"
                            value={customDescription}
                            onChange={setCustomDescription}
                            placeholder="What is it?"
                            maxLength={Limits.lineDescription}
                            autoFocus
                        />
                    </Cell>
                    <TextField label="Brand" value={customBrand} onChange={setCustomBrand} />
                    <TextField label="Size" value={customSize} onChange={setCustomSize} />
                    <TextField
                        label="Price"
                        value={customPrice}
                        onChange={setCustomPrice}
                        inputMode="decimal"
                        placeholder="0.00"
                    />
                    <Stepper label="Quantity" value={quantity} onChange={setQuantity} />
                    <Cell span={2}>
                        <TextArea
                            label="Note (optional)"
                            value={itemNotes}
                            onChange={setItemNotes}
                            placeholder="Printed under the item on the sales sheet"
                            maxLength={Limits.lineNotes}
                        />
                    </Cell>
                </Grid>
            )}

            {selected && (
                <View className="gap-4">
                    {selected.notes ? (
                        <View className="flex-row gap-2 rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-950/40">
                            <Icon
                                icon="fa-solid fa-circle-info"
                                className="mt-0.5 text-sm text-amber-800 dark:text-amber-300"
                            />
                            <Text className="flex-1 text-sm text-amber-800 dark:text-amber-300">
                                {selected.notes}
                            </Text>
                        </View>
                    ) : null}
                    {WarrantyText(selected) ? (
                        <View className="flex-row items-center gap-2">
                            <Icon
                                icon="fa-solid fa-shield-halved"
                                className="text-sm text-sky-800 dark:text-sky-300"
                            />
                            <Text className="text-sm font-medium text-sky-800 dark:text-sky-300">
                                {WarrantyText(selected)}
                            </Text>
                        </View>
                    ) : null}

                    <View>
                        <View className="mb-2 flex-row items-center justify-between gap-2">
                            <Label>Size &amp; configuration</Label>
                            <Pressable
                                onPress={() => setShowSizes(true)}
                                accessibilityRole="button"
                                className="min-h-[36px] flex-row items-center gap-1.5 rounded-lg px-2 active:bg-sky-50 dark:active:bg-sky-950/40"
                            >
                                <Icon
                                    icon="fa-solid fa-ruler-combined"
                                    className="text-sm text-sky-700 dark:text-sky-400"
                                />
                                <Text className="text-sm font-semibold text-sky-700 dark:text-sky-400">
                                    Size guide
                                </Text>
                            </Pressable>
                        </View>
                        <Grid columns={{ base: 2, sm: 3 }} gap={8}>
                            {(selected.variants ?? []).map((v) => {
                                const active = v.id === variantId;
                                const color = chipText(active);
                                const vSale = SaleFor(selected, v);
                                return (
                                    <Pressable
                                        key={v.id}
                                        onPress={() => chooseVariant(v)}
                                        accessibilityRole="radio"
                                        accessibilityState={{ checked: active }}
                                        className={cx(
                                            "min-h-[60px] justify-center rounded-xl px-3 py-2",
                                            chipBox(active)
                                        )}
                                    >
                                        <Text className={cx("text-sm font-semibold", color)}>
                                            {VariantLabel(v)}
                                        </Text>
                                        <Text className={cx("text-xs opacity-80", color)}>
                                            {NeedsPrice(v) ? (
                                                "Inquire"
                                            ) : HasDiscount(vSale) ? (
                                                <>
                                                    <Text
                                                        className={cx(
                                                            "text-xs line-through",
                                                            color
                                                        )}
                                                    >
                                                        {FormatCurrency(v.price)}
                                                    </Text>{" "}
                                                    <Text
                                                        className={cx("text-xs font-bold", color)}
                                                    >
                                                        {FormatCurrency(
                                                            ApplyDiscount(v.price ?? 0, vSale)
                                                        )}
                                                    </Text>{" "}
                                                    ({DiscountText(vSale)} off)
                                                </>
                                            ) : (
                                                FormatCurrency(v.price)
                                            )}
                                        </Text>
                                        {SizeStockText(selected, v) && (
                                            <Text
                                                className={cx(
                                                    "text-[11px] font-semibold opacity-90",
                                                    color
                                                )}
                                            >
                                                {SizeStockText(selected, v)}
                                            </Text>
                                        )}
                                        {(v.components ?? []).length > 0 && (
                                            <Text
                                                className={cx(
                                                    "mt-0.5 text-[11px] font-medium opacity-90",
                                                    color
                                                )}
                                            >
                                                + {IncludesText(v)}
                                            </Text>
                                        )}
                                    </Pressable>
                                );
                            })}
                        </Grid>
                    </View>

                    {/* The picked size's own note, such as a longer wait for a special order. */}
                    {variant?.notes ? (
                        <View className="flex-row gap-2 rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-950/40">
                            <Icon
                                icon="fa-solid fa-circle-info"
                                className="mt-0.5 text-sm text-amber-800 dark:text-amber-300"
                            />
                            <Text className="flex-1 text-sm text-amber-800 dark:text-amber-300">
                                {variant.notes}
                            </Text>
                        </View>
                    ) : null}

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
                        <View
                            key={component.componentVariantId}
                            className="gap-3 rounded-xl border border-violet-200 p-3 dark:border-violet-800"
                        >
                            <View className="flex-row items-center gap-2">
                                <Icon
                                    icon="fa-solid fa-link"
                                    className="text-sm text-violet-900 dark:text-violet-200"
                                />
                                <Text className="flex-1 text-sm font-semibold text-violet-900 dark:text-violet-200">
                                    Included:{" "}
                                    {(component.quantity ?? 1) > 1
                                        ? `${component.quantity} x `
                                        : ""}
                                    {product.name}
                                    {component.size ? ` - ${component.size}` : ""}
                                </Text>
                            </View>
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
                        </View>
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
                        <View>
                            <View className="mb-2">
                                <Label>Shipping</Label>
                            </View>
                            <View className="flex-row flex-wrap gap-2">
                                {(selected.deliveryOptions ?? []).map((option) => {
                                    const blocked = option.isTakeWith ? takeWithBlock : null;
                                    const active = option.deliveryOptionId === deliveryId;
                                    const color = chipText(active);
                                    const optionSale = DeliverySaleFor(option);

                                    return (
                                        <Pressable
                                            key={option.deliveryOptionId}
                                            disabled={Boolean(blocked)}
                                            onPress={() =>
                                                setDeliveryId(option.deliveryOptionId ?? null)
                                            }
                                            accessibilityRole="radio"
                                            accessibilityState={{
                                                checked: active,
                                                disabled: Boolean(blocked),
                                            }}
                                            className={cx(
                                                "min-h-[48px] justify-center rounded-xl px-4 py-1",
                                                chipBox(active),
                                                blocked && "opacity-50"
                                            )}
                                        >
                                            <Text className={cx("text-sm font-semibold", color)}>
                                                {option.name}
                                                {(option.price ?? 0) > 0 &&
                                                    (HasDiscount(optionSale) ? (
                                                        <>
                                                            {" +"}
                                                            <Text
                                                                className={cx(
                                                                    "text-sm line-through opacity-70",
                                                                    color
                                                                )}
                                                            >
                                                                {FormatCurrency(option.price)}
                                                            </Text>{" "}
                                                            {FormatCurrency(
                                                                ApplyDiscount(
                                                                    option.price ?? 0,
                                                                    optionSale
                                                                )
                                                            )}
                                                        </>
                                                    ) : (
                                                        ` +${FormatCurrency(option.price)}`
                                                    ))}
                                            </Text>
                                            {(option.price ?? 0) > 0 && HasDiscount(optionSale) && (
                                                <Text
                                                    className={cx("text-[11px] font-medium", color)}
                                                >
                                                    Sale {DiscountText(optionSale)} off
                                                </Text>
                                            )}
                                            {blocked && (
                                                <Text
                                                    className={cx("text-[11px] font-medium", color)}
                                                >
                                                    {blocked}
                                                </Text>
                                            )}
                                        </Pressable>
                                    );
                                })}
                            </View>
                            {shipList > 0 && HasDiscount(shipSale) && (
                                <Text className="mt-2 rounded-lg bg-zinc-100 px-3 py-2 text-sm dark:bg-zinc-700">
                                    {shipping?.name} {FormatCurrency(shipList)} - sale{" "}
                                    {DiscountText(shipSale)} off ={" "}
                                    <Text className="text-sm font-semibold">
                                        {FormatCurrency(shipSalePrice)}
                                    </Text>
                                </Text>
                            )}
                        </View>
                    )}

                    <Grid columns={2}>
                        <Stepper label="Quantity" value={quantity} onChange={changeQuantity} />
                        <DiscountInput
                            label={HasDiscount(sale) ? "Extra discount" : "Discount"}
                            mode={discountMode}
                            onModeChange={setDiscountMode}
                            value={discount}
                            onChange={setDiscount}
                        />
                    </Grid>

                    {listPrice !== null &&
                        (choicesChange !== 0 || HasDiscount(sale) || HasDiscount(repDiscount)) && (
                            <Text className="rounded-lg bg-zinc-100 px-3 py-2 text-sm dark:bg-zinc-700">
                                {FormatCurrency(listPrice)} each
                                {HasDiscount(sale) && (
                                    <>
                                        {" "}
                                        - sale {DiscountText(sale)} off ={" "}
                                        <Text className="text-sm font-semibold">
                                            {FormatCurrency(salePrice)}
                                        </Text>
                                    </>
                                )}
                                {HasDiscount(repDiscount) && (
                                    <>
                                        {" "}
                                        - {DiscountText(repDiscount)} off ={" "}
                                        <Text className="text-sm font-semibold">
                                            {FormatCurrency(finalPrice)}
                                        </Text>
                                    </>
                                )}
                            </Text>
                        )}

                    <TextArea
                        label="Note (optional)"
                        value={itemNotes}
                        onChange={setItemNotes}
                        placeholder="ex. Floor model"
                        maxLength={Limits.lineNotes}
                    />
                </View>
            )}

            {showSizes && <SizeGuideModal onClose={() => setShowSizes(false)} />}
        </Modal>
    );
};

export default AddItemModal;
