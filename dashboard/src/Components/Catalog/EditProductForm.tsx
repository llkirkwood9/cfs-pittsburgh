import { useState } from "react";
import BundlePickerModal from "./BundlePickerModal";
import type { BundlePick } from "./BundlePickerModal";
import OptionsEditor, { FromDraftOptions, OptionsProblem, ToDraftOptions } from "./OptionsEditor";
import type { DraftOption } from "./OptionsEditor";
import SaleEditor, { FromSaleDraft, SaleProblem, ToSaleDraft } from "./SaleEditor";
import type { SaleDraft } from "./SaleEditor";
import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import Modal from "../Elements/Modal";
import TextField from "../Elements/TextField";
import { ParseMoney } from "../../Lib/ModelHelpers";
import { CleanDiscount, DiscountText, HasDiscount } from "../../Lib/Pricing";
import { Toast } from "../../Lib/Toast";
import type { DeliveryOption } from "../../Models/DeliveryOption";
import type { Product, ProductCategory } from "../../Models/Product";
import type { ProductDeliveryOption } from "../../Models/ProductDeliveryOption";
import type { ProductVariant } from "../../Models/ProductVariant";

type Props = {
    product: Product;
    catalog: Product[];
    categories: ProductCategory[];
    deliveryOptions: DeliveryOption[];
    onSave: (product: Product) => Promise<void>;
    onClose: () => void;
};

type DraftVariant = ProductVariant & { priceText: string; sale: SaleDraft };

/**
 * Full product editor: name, brand, category, every priced size/configuration row, and which
 * delivery services are offered with what price. This is what makes delivery types differ from
 * one mattress to the next.
 */
const EditProductForm = ({
    product,
    catalog,
    categories,
    deliveryOptions,
    onSave,
    onClose,
}: Props) => {
    const [name, setName] = useState<string>(product.name ?? "");
    const [brand, setBrand] = useState<string>(product.brand ?? "");
    const [category, setCategory] = useState<ProductCategory>(product.category ?? "Misc");
    const [notes, setNotes] = useState<string>(product.notes ?? "");
    const [isActive, setIsActive] = useState<boolean>(product.isActive ?? true);
    const [trackInventory, setTrackInventory] = useState<boolean>(product.trackInventory ?? false);
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
    };

    const setDeliveryOverride = (deliveryOptionId: number, value: string) =>
        setDelivery((rows) =>
            rows.map((row) =>
                row.deliveryOptionId === deliveryOptionId
                    ? { ...row, priceOverride: value.trim() === "" ? null : ParseMoney(value) }
                    : row
            )
        );

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
            name: name.trim(),
            brand: brand.trim(),
            category,
            notes: notes.trim(),
            isActive,
            trackInventory,
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
                    <Button
                        text="Cancel"
                        onClick={onClose}
                        className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                    />
                    <Button
                        text="Save"
                        icon="fa-solid fa-check"
                        onClick={handleSave}
                        loading={saving}
                    />
                </>
            }
        >
            <div className="space-y-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <TextField label="Name" value={name} onChange={setName} maxLength={150} />
                    <TextField label="Brand" value={brand} onChange={setBrand} maxLength={100} />

                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Category
                        </span>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value as ProductCategory)}
                            className="min-h-[48px] rounded-xl border border-zinc-300 bg-white px-3 text-base
                                text-zinc-900 outline-hidden focus:border-sky-600
                                dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                        >
                            {categories.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="flex min-h-[48px] cursor-pointer items-center gap-3 self-end rounded-xl bg-zinc-100 px-3 dark:bg-zinc-700">
                        <input
                            type="checkbox"
                            checked={isActive}
                            onChange={(e) => setIsActive(e.target.checked)}
                            className="h-5 w-5 accent-sky-600"
                        />
                        <span className="text-sm font-medium">Offered on the floor</span>
                    </label>

                    <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl bg-zinc-100 px-3 py-2 sm:col-span-2 dark:bg-zinc-700">
                        <input
                            type="checkbox"
                            checked={trackInventory}
                            onChange={(e) => setTrackInventory(e.target.checked)}
                            className="h-5 w-5 accent-sky-600"
                        />
                        <span className="text-sm">
                            <span className="font-medium">Track inventory</span>
                            <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                                For items kept at the cart, such as pillows and protectors. Take
                                With is only allowed while a size is in stock. Set the counts on the
                                Inventory screen. A size can be left out below.
                            </span>
                        </span>
                    </label>

                    <TextField
                        label="Notes shown to the rep"
                        value={notes}
                        onChange={setNotes}
                        className="sm:col-span-2"
                        maxLength={500}
                        placeholder="ex. Sale, warranty info"
                    />

                    <div className="sm:col-span-2">
                        <SaleEditor label="Sale on every size" draft={sale} onChange={setSale} />
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            Taken off when the item goes on an order; a size can set its own sale
                            below. Items already on orders keep the price they were added at.
                        </p>
                    </div>
                </div>

                <section>
                    <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Sizes &amp; pricing
                        </h3>
                        <Button
                            text="Add size"
                            icon="fa-solid fa-plus"
                            onClick={addVariant}
                            className="min-h-[40px] px-3 text-sm"
                        />
                    </div>

                    <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                        Leave a price blank to mark it Inquire - the rep will have to key a price in
                        before that size can be sold. Use Include item to make a size a bundle, such
                        as a mattress sold with an adjustable base: the included items print as
                        their own rows on the sales sheet at no extra charge.
                    </p>

                    <ul className="space-y-2">
                        {variants.map((variant, index) => (
                            <li
                                key={variant.id ?? `new-${index}`}
                                className="grid grid-cols-2 items-end gap-2 rounded-xl bg-zinc-100 p-3 sm:grid-cols-12 dark:bg-zinc-700"
                            >
                                <TextField
                                    label="Size"
                                    value={variant.size ?? ""}
                                    onChange={(value) => setVariant(index, { size: value })}
                                    className="sm:col-span-3"
                                    maxLength={50}
                                />
                                <TextField
                                    label="Configuration"
                                    value={variant.configuration ?? ""}
                                    onChange={(value) =>
                                        setVariant(index, { configuration: value })
                                    }
                                    className="sm:col-span-5"
                                    maxLength={100}
                                    placeholder="Mattress Only"
                                />
                                <TextField
                                    label="Price"
                                    value={variant.priceText}
                                    onChange={(value) => setVariant(index, { priceText: value })}
                                    inputMode="decimal"
                                    className="sm:col-span-3"
                                    placeholder="Inquire"
                                />

                                <button
                                    type="button"
                                    onClick={() => removeVariant(index)}
                                    aria-label="Remove size"
                                    className="flex h-12 items-center justify-center rounded-xl text-red-700
                                        hover:bg-red-100 sm:col-span-1 dark:text-red-400 dark:hover:bg-red-950/40"
                                >
                                    <Icon icon="fa-solid fa-trash" />
                                </button>

                                <div className="col-span-full">
                                    <SaleEditor
                                        label="Sale for this size"
                                        draft={variant.sale}
                                        onChange={(next) => setVariant(index, { sale: next })}
                                        allowFollow
                                        followLabel={itemSaleLabel}
                                    />
                                </div>

                                {trackInventory && (
                                    <label className="col-span-full flex min-h-[40px] cursor-pointer items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={!variant.excludeFromInventory}
                                            onChange={(e) =>
                                                setVariant(index, {
                                                    excludeFromInventory: !e.target.checked,
                                                })
                                            }
                                            className="h-5 w-5 accent-sky-600"
                                        />
                                        <span className="text-sm">
                                            <span className="font-medium">Count in inventory</span>
                                            <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                                                Untick for a size that isn&apos;t kept at the cart.
                                                It won&apos;t be counted or shown on the Inventory
                                                screen, and Take With isn&apos;t limited by stock.
                                            </span>
                                        </span>
                                    </label>
                                )}

                                <div className="col-span-full flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                        Bundle
                                    </span>
                                    {(variant.components ?? []).map((c) => (
                                        <span
                                            key={c.componentVariantId}
                                            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-violet-100 pl-3 text-sm
                                                font-medium text-violet-900 dark:bg-violet-900/50 dark:text-violet-200"
                                        >
                                            {(c.quantity ?? 1) > 1 && `${c.quantity} x `}
                                            {c.productName}
                                            {c.size ? ` - ${c.size}` : ""}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    removeComponent(index, c.componentVariantId)
                                                }
                                                aria-label={`Remove ${c.productName} from the bundle`}
                                                className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-violet-200 dark:hover:bg-violet-800"
                                            >
                                                <Icon icon="fa-solid fa-xmark" />
                                            </button>
                                        </span>
                                    ))}
                                    <Button
                                        text="Include item"
                                        icon="fa-solid fa-link"
                                        onClick={() => setBundlingIndex(index)}
                                        className="min-h-[36px] bg-violet-700 px-3 text-sm hover:bg-violet-800 dark:bg-violet-600 dark:hover:bg-violet-700"
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>

                <OptionsEditor
                    options={options}
                    onChange={setOptions}
                    trackInventory={trackInventory}
                />

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

                <section>
                    <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Delivery options for this product
                    </h3>
                    <ul className="space-y-2">
                        {deliveryOptions.map((option) => {
                            const selected = delivery.find((d) => d.deliveryOptionId === option.id);

                            return (
                                <li
                                    key={option.id}
                                    className="flex flex-wrap items-center gap-3 rounded-xl bg-zinc-100 p-3 dark:bg-zinc-700"
                                >
                                    <label className="flex min-w-40 flex-1 cursor-pointer items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(selected)}
                                            onChange={() => toggleDelivery(option)}
                                            className="h-5 w-5 accent-sky-600"
                                        />
                                        <span className="text-sm font-medium">{option.name}</span>
                                    </label>

                                    {selected && (
                                        <>
                                            <input
                                                value={
                                                    selected.priceOverride === null ||
                                                    selected.priceOverride === undefined
                                                        ? ""
                                                        : String(selected.priceOverride)
                                                }
                                                onChange={(e) =>
                                                    option.id &&
                                                    setDeliveryOverride(option.id, e.target.value)
                                                }
                                                inputMode="decimal"
                                                placeholder={`Default ${option.price ?? 0}`}
                                                className="min-h-[44px] w-32 rounded-lg border border-zinc-300 bg-white px-2
                                                    text-sm dark:border-zinc-600 dark:bg-zinc-800"
                                            />
                                            <label className="flex cursor-pointer items-center gap-2 text-xs">
                                                <input
                                                    type="radio"
                                                    name="default-delivery"
                                                    checked={selected.isDefault ?? false}
                                                    onChange={() =>
                                                        option.id && setDefaultDelivery(option.id)
                                                    }
                                                    className="h-4 w-4 accent-sky-600"
                                                />
                                                Default
                                            </label>
                                            <div className="w-full">
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
                                                    followLabel={
                                                        HasDiscount(
                                                            CleanDiscount(
                                                                option.saleDiscountPercent,
                                                                option.saleDiscountAmount
                                                            )
                                                        )
                                                            ? `${DiscountText(
                                                                  CleanDiscount(
                                                                      option.saleDiscountPercent,
                                                                      option.saleDiscountAmount
                                                                  )
                                                              )} off`
                                                            : "no sale"
                                                    }
                                                    label={`${option.name} sale`}
                                                />
                                            </div>
                                        </>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </section>
            </div>
        </Modal>
    );
};

export default EditProductForm;
