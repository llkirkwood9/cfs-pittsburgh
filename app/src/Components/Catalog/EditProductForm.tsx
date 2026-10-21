import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import BundlePickerModal from "./BundlePickerModal";
import type { BundlePick } from "./BundlePickerModal";
import CopyFromTerritory from "./CopyFromTerritory";
import OptionsEditor, { FromDraftOptions, OptionsProblem, ToDraftOptions } from "./OptionsEditor";
import type { DraftOption } from "./OptionsEditor";
import SaleEditor, { FromSaleDraft, SaleProblem, ToSaleDraft } from "./SaleEditor";
import type { SaleDraft } from "./SaleEditor";
import Button from "../Elements/Button";
import Checkbox from "../Elements/Checkbox";
import Grid, { Cell } from "../Elements/Grid";
import Icon from "../Elements/Icon";
import IconButton from "../Elements/IconButton";
import Modal from "../Elements/Modal";
import SelectField from "../Elements/SelectField";
import Text from "../Elements/Text";
import TextField from "../Elements/TextField";
import { cx } from "../../Lib/ClassNames";
import { ParseMoney } from "../../Lib/ModelHelpers";
import { CleanDiscount, DiscountText, HasDiscount } from "../../Lib/Pricing";
import { Toast } from "../../Lib/Toast";
import type { DeliveryOption } from "../../Models/DeliveryOption";
import type { Product, ProductCategory } from "../../Models/Product";
import type { ProductDeliveryOption } from "../../Models/ProductDeliveryOption";
import type { Territory } from "../../Models/Territory";
import type { ProductVariant } from "../../Models/ProductVariant";

type Props = {
    product: Product;
    catalog: Product[];
    categories: ProductCategory[];
    deliveryOptions: DeliveryOption[];
    onSave: (product: Product) => Promise<void>;
    onClose: () => void;
    /** For a new item: the user's other territories, whose catalogs it can be copied from instead. */
    copySources?: Territory[];
    /** A product was copied in from another territory's catalog. */
    onCopied?: (product: Product) => void;
};

type DraftVariant = ProductVariant & { priceText: string; sale: SaleDraft };

const heading = "text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400";

/**
 * Full product editor: name, brand, category, every priced size/configuration row, and which
 * delivery services are offered with what price. This is what makes delivery types differ from
 * one mattress to the next. Each territory has its own catalog, so an item only includes and
 * offers things from its own territory's. Someone with more than one territory can start a new
 * item as a copy of one from another territory's catalog.
 */
const EditProductForm = ({
    product,
    catalog,
    categories,
    deliveryOptions,
    onSave,
    onClose,
    copySources = [],
    onCopied,
}: Props) => {
    const [name, setName] = useState<string>(product.name ?? "");
    const [brand, setBrand] = useState<string>(product.brand ?? "");
    const [category, setCategory] = useState<ProductCategory>(product.category ?? "Misc");
    const [notes, setNotes] = useState<string>(product.notes ?? "");
    const [isActive, setIsActive] = useState<boolean>(product.isActive ?? true);
    const [trackInventory, setTrackInventory] = useState<boolean>(product.trackInventory ?? false);
    // Until it is ticked or unticked, a new product follows its category: mattresses and bases
    // have a warranty.
    const [warrantyChoice, setWarrantyChoice] = useState<boolean | null>(product.hasWarranty ?? null);
    const hasWarranty = warrantyChoice ?? (category === "Mattress" || category === "AdjustableBase");
    const [warrantyLength, setWarrantyLength] = useState<string>(product.warrantyLength ?? "");
    const [saving, setSaving] = useState<boolean>(false);
    const [sale, setSale] = useState<SaleDraft>(
        ToSaleDraft(product.saleDiscountPercent, product.saleDiscountAmount)
    );
    const [options, setOptions] = useState<DraftOption[]>(ToDraftOptions(product.options));

    const [variants, setVariants] = useState<DraftVariant[]>(
        (product.variants ?? []).map((v) => ({
            ...v,
            priceText: v.price === null || v.price === undefined ? "" : String(v.price),
            sale: ToSaleDraft(v.saleDiscountPercent, v.saleDiscountAmount, !v.hasOwnSale),
        }))
    );

    // What a size following the item's sale gets, for its label.
    const itemSale = FromSaleDraft(sale);
    const itemSaleLabel =
        SaleProblem(sale) === null && sale.mode !== "none"
            ? `${DiscountText({ percent: itemSale.percent || null, amount: itemSale.amount || null })} off`
            : "no sale";

    const [delivery, setDelivery] = useState<ProductDeliveryOption[]>(
        product.deliveryOptions ?? []
    );
    // The price override as typed, so a half-typed "12." isn't rounded away mid-entry.
    const [overrideText, setOverrideText] = useState<Record<number, string>>(() =>
        Object.fromEntries(
            (product.deliveryOptions ?? []).map((d) => [
                d.deliveryOptionId ?? 0,
                d.priceOverride === null || d.priceOverride === undefined ? "" : String(d.priceOverride),
            ])
        )
    );
    // This product's own sale on each delivery choice, or "follow" for the option's own.
    const [deliverySales, setDeliverySales] = useState<Record<number, SaleDraft>>(() =>
        Object.fromEntries(
            (product.deliveryOptions ?? []).map((d) => [
                d.deliveryOptionId ?? 0,
                ToSaleDraft(d.saleDiscountPercent, d.saleDiscountAmount, !d.hasOwnSale),
            ])
        )
    );
    const deliverySale = (id?: number): SaleDraft =>
        deliverySales[id ?? 0] ?? { mode: "follow", text: "" };
    const [bundlingIndex, setBundlingIndex] = useState<number | null>(null);

    const setVariant = (index: number, changes: Partial<DraftVariant>) =>
        setVariants((rows) => rows.map((row, i) => (i === index ? { ...row, ...changes } : row)));

    const addVariant = () =>
        setVariants((rows) => [
            ...rows,
            {
                size: "",
                configuration: "",
                priceText: "",
                sale: { mode: "follow", text: "" },
                components: [],
                isActive: true,
                sortOrder: rows.length + 1,
            },
        ]);

    const removeVariant = (index: number) =>
        setVariants((rows) => rows.filter((_, i) => i !== index));

    /**
     * Adds a picked item to one size's bundle, and optionally to every other size of the same
     * configuration using the picked product's matching size. Sizes the item does not come in
     * are skipped rather than given a mismatched size.
     */
    const applyBundlePick = (index: number, pick: BundlePick) => {
        const source = variants[index];
        const sameConfig = (v: DraftVariant) =>
            (v.configuration ?? "").trim().toLowerCase() ===
            (source.configuration ?? "").trim().toLowerCase();

        let skipped = 0;

        const next = variants.map((row, i) => {
            const isSource = i === index;
            if (!isSource && !(pick.matchSizes && sameConfig(row))) return row;

            const component = isSource
                ? pick.variant
                : pick.product.variants?.find(
                      (v) =>
                          (v.components ?? []).length === 0 &&
                          (v.size ?? "").toLowerCase() === (row.size ?? "").toLowerCase()
                  );

            if (!component?.id) {
                skipped++;
                return row;
            }

            const others = (row.components ?? []).filter(
                (c) => c.componentVariantId !== component.id
            );

            return {
                ...row,
                components: [
                    ...others,
                    {
                        componentVariantId: component.id,
                        quantity: pick.quantity,
                        productId: pick.product.id,
                        productName: pick.product.name,
                        brand: pick.product.brand,
                        category: pick.product.category,
                        size: component.size,
                        configuration: component.configuration,
                    },
                ],
            };
        });

        setVariants(next);

        if (skipped > 0)
            Toast.Info(`${pick.product.name} has no matching size for ${skipped} of these sizes.`);
    };

    const removeComponent = (index: number, componentVariantId?: number) =>
        setVariant(index, {
            components: (variants[index].components ?? []).filter(
                (c) => c.componentVariantId !== componentVariantId
            ),
        });

    const toggleDelivery = (option: DeliveryOption) => {
        const existing = delivery.find((d) => d.deliveryOptionId === option.id);

        if (existing) {
            setDelivery((rows) => rows.filter((d) => d.deliveryOptionId !== option.id));
            return;
        }

        setDelivery((rows) => [
            ...rows,
            {
                deliveryOptionId: option.id,
                name: option.name,
                price: option.price,
                priceOverride: null,
                isDefault: rows.length === 0,
            },
        ]);
        setOverrideText((current) => ({ ...current, [option.id ?? 0]: "" }));
    };

    const setDeliveryOverride = (deliveryOptionId: number, value: string) => {
        setOverrideText((current) => ({ ...current, [deliveryOptionId]: value }));
        setDelivery((rows) =>
            rows.map((row) =>
                row.deliveryOptionId === deliveryOptionId
                    ? { ...row, priceOverride: value.trim() === "" ? null : ParseMoney(value) }
                    : row
            )
        );
    };

    const setDefaultDelivery = (deliveryOptionId: number) =>
        setDelivery((rows) =>
            rows.map((row) => ({ ...row, isDefault: row.deliveryOptionId === deliveryOptionId }))
        );

    const handleSave = async () => {
        if (!name.trim()) return Toast.Warning("Give the product a name.");
        if (variants.some((v) => !(v.size ?? "").trim()))
            return Toast.Warning("Every size row needs a size.");

        const saleProblem = SaleProblem(sale);
        if (saleProblem) return Toast.Warning(saleProblem);
        const sizeSale = variants.find((v) => SaleProblem(v.sale));
        if (sizeSale) return Toast.Warning(`${sizeSale.size}: ${SaleProblem(sizeSale.sale)}`);

        const optionsProblem = OptionsProblem(options);
        if (optionsProblem) return Toast.Warning(optionsProblem);

        const badDelivery = delivery.find((d) => SaleProblem(deliverySale(d.deliveryOptionId)));
        if (badDelivery)
            return Toast.Warning(
                `${badDelivery.name}: ${SaleProblem(deliverySale(badDelivery.deliveryOptionId))}`
            );

        setSaving(true);
        await onSave({
            id: product.id,
            territoryId: product.territoryId,
            name: name.trim(),
            brand: brand.trim(),
            category,
            notes: notes.trim(),
            isActive,
            trackInventory,
            hasWarranty,
            warrantyLength: warrantyLength.trim(),
            sortOrder: product.sortOrder ?? 0,
            saleDiscountPercent: itemSale.percent,
            saleDiscountAmount: itemSale.amount,
            options: FromDraftOptions(options),
            variants: variants.map((v, index) => ({
                id: v.id,
                size: (v.size ?? "").trim(),
                configuration: (v.configuration ?? "").trim() || null,
                // A blank price is stored as null, which the floor shows as "Inquire" and forces
                // the rep to key a price in rather than sell at a guess.
                price: v.priceText.trim() === "" ? null : ParseMoney(v.priceText),
                components: (v.components ?? []).map((c) => ({
                    componentVariantId: c.componentVariantId,
                    quantity: c.quantity ?? 1,
                })),
                isActive: v.isActive ?? true,
                excludeFromInventory: v.excludeFromInventory ?? false,
                notes: (v.notes ?? "").trim() || null,
                sortOrder: index + 1,
                hasOwnSale: v.sale.mode !== "follow",
                saleDiscountPercent: FromSaleDraft(v.sale).percent,
                saleDiscountAmount: FromSaleDraft(v.sale).amount,
            })),
            deliveryOptions: delivery.map((d) => {
                const draft = deliverySale(d.deliveryOptionId);
                const off = FromSaleDraft(draft);
                return {
                    ...d,
                    hasOwnSale: draft.mode !== "follow",
                    saleDiscountPercent: off.percent,
                    saleDiscountAmount: off.amount,
                };
            }),
        });
        setSaving(false);
        onClose();
    };

    return (
        <Modal
            title={product.id ? "Edit product" : "New product"}
            onClose={onClose}
            wide
            footer={
                <>
                    <Button text="Cancel" onClick={onClose} className="bg-zinc-500 dark:bg-zinc-600" />
                    <Button text="Save" icon="fa-solid fa-check" onClick={handleSave} loading={saving} />
                </>
            }
        >
            <View className="gap-5">
                {!product.id && copySources.length > 0 && onCopied && (
                    <CopyFromTerritory territories={copySources} onCopied={onCopied} />
                )}
                <Grid columns={{ base: 1, sm: 2 }}>
                    <TextField
                        label="Name"
                        value={name}
                        onChange={setName}
                        maxLength={150}
                        autoCapitalize="words"
                    />
                    <TextField
                        label="Brand"
                        value={brand}
                        onChange={setBrand}
                        maxLength={100}
                        autoCapitalize="words"
                    />
                    <SelectField
                        label="Category"
                        value={category}
                        options={categories.map((c) => ({ value: c, label: c }))}
                        onChange={setCategory}
                    />
                    <View className="flex-1 justify-end">
                        <Checkbox label="Offered on the floor" checked={isActive} onChange={setIsActive} />
                    </View>
                    <Cell span={{ base: 1, sm: 2 }}>
                        <Checkbox
                            label="Track inventory"
                            checked={trackInventory}
                            onChange={setTrackInventory}
                        />
                    </Cell>
                    {/* Decides whether the customer initials the warranty statement. */}
                    <View className="flex-1 justify-end">
                        <Checkbox
                            label="Has a manufacturer warranty"
                            checked={hasWarranty}
                            onChange={setWarrantyChoice}
                        />
                    </View>
                    <TextField
                        label="Warranty length"
                        value={warrantyLength}
                        onChange={setWarrantyLength}
                        maxLength={60}
                        placeholder="ex. 10 years"
                        disabled={!hasWarranty}
                    />
                    <Cell span={{ base: 1, sm: 2 }}>
                        <TextField
                            label="Notes shown to the rep"
                            value={notes}
                            onChange={setNotes}
                            maxLength={500}
                            placeholder="ex. Sale, warranty info"
                        />
                    </Cell>
                    <Cell span={{ base: 1, sm: 2 }}>
                        <SaleEditor label="Sale on every size" draft={sale} onChange={setSale} />
                    </Cell>
                </Grid>

                <View>
                    <View className="mb-2 flex-row items-center justify-between">
                        <Text className={heading}>Sizes & pricing</Text>
                        <Button
                            text="Add size"
                            icon="fa-solid fa-plus"
                            onClick={addVariant}
                            className="min-h-[40px] px-3 text-sm"
                        />
                    </View>

                    <Text className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                        Leave a price blank for Inquire.
                    </Text>

                    <View className="gap-2">
                        {variants.map((variant, index) => (
                            <View
                                key={variant.id ?? `new-${index}`}
                                className="gap-3 rounded-xl bg-zinc-100 p-3 dark:bg-zinc-700"
                            >
                                <View className="flex-row flex-wrap items-end gap-2">
                                    <TextField
                                        label="Size"
                                        value={variant.size ?? ""}
                                        onChange={(value) => setVariant(index, { size: value })}
                                        maxLength={50}
                                        autoCapitalize="words"
                                        className="min-w-[110px] flex-[3]"
                                    />
                                    <TextField
                                        label="Configuration"
                                        value={variant.configuration ?? ""}
                                        onChange={(value) => setVariant(index, { configuration: value })}
                                        maxLength={100}
                                        placeholder="Mattress Only"
                                        autoCapitalize="words"
                                        className="min-w-[160px] flex-[5]"
                                    />
                                    <TextField
                                        label="Price"
                                        value={variant.priceText}
                                        onChange={(value) => setVariant(index, { priceText: value })}
                                        inputMode="decimal"
                                        placeholder="Inquire"
                                        className="min-w-[100px] flex-[3]"
                                    />
                                    <IconButton
                                        icon="fa-solid fa-trash"
                                        label="Remove size"
                                        onPress={() => removeVariant(index)}
                                        danger
                                        className="h-12 w-12 rounded-xl"
                                    />
                                </View>

                                <TextField
                                    label="Note for the rep"
                                    value={variant.notes ?? ""}
                                    onChange={(value) => setVariant(index, { notes: value })}
                                    maxLength={300}
                                    placeholder="ex. Not compressed"
                                />

                                <SaleEditor
                                    label="Sale for this size"
                                    draft={variant.sale}
                                    onChange={(next) => setVariant(index, { sale: next })}
                                    allowFollow
                                    followLabel={itemSaleLabel}
                                />

                                {trackInventory && (
                                    <Checkbox
                                        label="Count in inventory"
                                        checked={!variant.excludeFromInventory}
                                        onChange={(checked) =>
                                            setVariant(index, { excludeFromInventory: !checked })
                                        }
                                        className="bg-white dark:bg-zinc-800"
                                    />
                                )}

                                <View className="flex-row flex-wrap items-center gap-2">
                                    <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                        Bundle
                                    </Text>
                                    {(variant.components ?? []).map((c) => (
                                        <View
                                            key={c.componentVariantId}
                                            className="min-h-[36px] flex-row items-center gap-1 rounded-lg bg-violet-100 pl-3 dark:bg-violet-900/50"
                                        >
                                            <Text className="text-sm font-medium text-violet-900 dark:text-violet-200">
                                                {(c.quantity ?? 1) > 1 && `${c.quantity} x `}
                                                {c.productName}
                                                {c.size ? ` - ${c.size}` : ""}
                                            </Text>
                                            <Pressable
                                                onPress={() => removeComponent(index, c.componentVariantId)}
                                                accessibilityRole="button"
                                                accessibilityLabel={`Remove ${c.productName} from the bundle`}
                                                className="h-9 w-9 items-center justify-center rounded-lg active:bg-violet-200 dark:active:bg-violet-800"
                                            >
                                                <Icon
                                                    icon="fa-solid fa-xmark"
                                                    className="text-violet-900 dark:text-violet-200"
                                                />
                                            </Pressable>
                                        </View>
                                    ))}
                                    <Button
                                        text="Include item"
                                        icon="fa-solid fa-link"
                                        onClick={() => setBundlingIndex(index)}
                                        className="min-h-[36px] bg-violet-700 px-3 text-sm dark:bg-violet-600"
                                    />
                                </View>
                            </View>
                        ))}
                    </View>
                </View>

                <OptionsEditor options={options} onChange={setOptions} trackInventory={trackInventory} />

                <View>
                    <Text className={cx(heading, "mb-2")}>Delivery options for this product</Text>
                    <View className="gap-2">
                        {deliveryOptions.length === 0 && (
                            <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                                This territory has no delivery options yet.
                            </Text>
                        )}
                        {deliveryOptions.map((option) => {
                            const selected = delivery.find((d) => d.deliveryOptionId === option.id);
                            const off = CleanDiscount(option.saleDiscountPercent, option.saleDiscountAmount);

                            return (
                                <View
                                    key={option.id}
                                    className="gap-3 rounded-xl bg-zinc-100 p-3 dark:bg-zinc-700"
                                >
                                    <View className="flex-row flex-wrap items-center gap-3">
                                        <Pressable
                                            onPress={() => toggleDelivery(option)}
                                            accessibilityRole="checkbox"
                                            accessibilityState={{ checked: Boolean(selected) }}
                                            className="min-h-[44px] min-w-[160px] flex-1 flex-row items-center gap-3"
                                        >
                                            <Icon
                                                icon={selected ? "fa-solid fa-square-check" : "fa-regular fa-square"}
                                                className={cx(
                                                    "text-xl",
                                                    selected ? "text-sky-700 dark:text-sky-400" : "text-zinc-400"
                                                )}
                                            />
                                            <Text className="flex-1 text-sm font-medium">{option.name}</Text>
                                        </Pressable>

                                        {selected && option.id ? (
                                            <>
                                                <TextInput
                                                    value={overrideText[option.id] ?? ""}
                                                    onChangeText={(value) =>
                                                        option.id && setDeliveryOverride(option.id, value)
                                                    }
                                                    keyboardType="decimal-pad"
                                                    inputMode="decimal"
                                                    placeholder={`Default ${option.price ?? 0}`}
                                                    placeholderTextColor="#a1a1aa"
                                                    accessibilityLabel={`${option.name} price for this product`}
                                                    className="min-h-[44px] w-32 rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900
                                                        dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                                                />
                                                <Pressable
                                                    onPress={() => option.id && setDefaultDelivery(option.id)}
                                                    accessibilityRole="radio"
                                                    accessibilityState={{ checked: selected.isDefault ?? false }}
                                                    className="min-h-[44px] flex-row items-center gap-2"
                                                >
                                                    <Icon
                                                        icon={
                                                            selected.isDefault
                                                                ? "fa-solid fa-circle-dot"
                                                                : "fa-regular fa-circle"
                                                        }
                                                        className={cx(
                                                            "text-base",
                                                            selected.isDefault
                                                                ? "text-sky-700 dark:text-sky-400"
                                                                : "text-zinc-400"
                                                        )}
                                                    />
                                                    <Text className="text-xs">Default</Text>
                                                </Pressable>
                                            </>
                                        ) : null}
                                    </View>

                                    {selected && (
                                        <SaleEditor
                                            draft={deliverySale(option.id)}
                                            onChange={(draft) =>
                                                setDeliverySales((current) => ({
                                                    ...current,
                                                    [option.id ?? 0]: draft,
                                                }))
                                            }
                                            allowFollow
                                            followName="Same as option"
                                            followLabel={HasDiscount(off) ? `${DiscountText(off)} off` : "no sale"}
                                            label={`${option.name} sale`}
                                        />
                                    )}
                                </View>
                            );
                        })}
                    </View>
                </View>
            </View>

            {bundlingIndex !== null && (
                <BundlePickerModal
                    catalog={catalog}
                    excludeProductId={product.id}
                    size={variants[bundlingIndex]?.size}
                    configuration={variants[bundlingIndex]?.configuration}
                    onPick={(pick) => applyBundlePick(bundlingIndex, pick)}
                    onClose={() => setBundlingIndex(null)}
                />
            )}
        </Modal>
    );
};

export default EditProductForm;
