import { useState } from "react";
import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import Modal from "../Elements/Modal";
import TextField from "../Elements/TextField";
import { ParseMoney } from "../../Lib/ModelHelpers";
import { Toast } from "../../Lib/Toast";
import type { DeliveryOption } from "../../Models/DeliveryOption";
import type { Product, ProductCategory } from "../../Models/Product";
import type { ProductDeliveryOption } from "../../Models/ProductDeliveryOption";
import type { ProductVariant } from "../../Models/ProductVariant";

type Props = {
    product: Product;
    categories: ProductCategory[];
    deliveryOptions: DeliveryOption[];
    onSave: (product: Product) => Promise<void>;
    onClose: () => void;
};

type DraftVariant = ProductVariant & { priceText: string };

/**
 * Full product editor: name, brand, category, every priced size/configuration row, and which
 * delivery services are offered with what price. This is what makes delivery types differ from
 * one mattress to the next.
 */
const EditProductForm = ({ product, categories, deliveryOptions, onSave, onClose }: Props) => {
    const [name, setName] = useState<string>(product.name ?? "");
    const [brand, setBrand] = useState<string>(product.brand ?? "");
    const [category, setCategory] = useState<ProductCategory>(product.category ?? "Misc");
    const [notes, setNotes] = useState<string>(product.notes ?? "");
    const [isActive, setIsActive] = useState<boolean>(product.isActive ?? true);
    const [saving, setSaving] = useState<boolean>(false);

    const [variants, setVariants] = useState<DraftVariant[]>(
        (product.variants ?? []).map((v) => ({
            ...v,
            priceText: v.price === null || v.price === undefined ? "" : String(v.price),
        }))
    );

    const [delivery, setDelivery] = useState<ProductDeliveryOption[]>(product.deliveryOptions ?? []);

    const setVariant = (index: number, changes: Partial<DraftVariant>) =>
        setVariants((rows) => rows.map((row, i) => (i === index ? { ...row, ...changes } : row)));

    const addVariant = () =>
        setVariants((rows) => [
            ...rows,
            {
                size: "",
                configuration: "",
                priceText: "",
                includesAdjustableBase: false,
                isActive: true,
                sortOrder: rows.length + 1,
            },
        ]);

    const removeVariant = (index: number) =>
        setVariants((rows) => rows.filter((_, i) => i !== index));

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

        setSaving(true);
        await onSave({
            id: product.id,
            name: name.trim(),
            brand: brand.trim(),
            category,
            notes: notes.trim(),
            isActive,
            sortOrder: product.sortOrder ?? 0,
            variants: variants.map((v, index) => ({
                id: v.id,
                size: (v.size ?? "").trim(),
                configuration: (v.configuration ?? "").trim() || null,
                // A blank price is stored as null, which the floor shows as "Inquire" and forces
                // the rep to key a price in rather than sell at a guess.
                price: v.priceText.trim() === "" ? null : ParseMoney(v.priceText),
                includesAdjustableBase: v.includesAdjustableBase ?? false,
                isActive: v.isActive ?? true,
                sortOrder: index + 1,
            })),
            deliveryOptions: delivery,
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
                    <Button text="Save" icon="fa-solid fa-check" onClick={handleSave} loading={saving} />
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
                                text-zinc-900 outline-none focus:border-sky-600
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

                    <TextField
                        label="Notes shown to the rep"
                        value={notes}
                        onChange={setNotes}
                        className="sm:col-span-2"
                        maxLength={500}
                        placeholder="e.g. 25% off sale"
                    />
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
                        before that size can be sold.
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
                                    className="sm:col-span-2"
                                    maxLength={50}
                                />
                                <TextField
                                    label="Configuration"
                                    value={variant.configuration ?? ""}
                                    onChange={(value) => setVariant(index, { configuration: value })}
                                    className="sm:col-span-4"
                                    maxLength={100}
                                    placeholder="Mattress Only"
                                />
                                <TextField
                                    label="Price"
                                    value={variant.priceText}
                                    onChange={(value) => setVariant(index, { priceText: value })}
                                    inputMode="decimal"
                                    className="sm:col-span-2"
                                    placeholder="Inquire"
                                />

                                <label className="flex min-h-[48px] cursor-pointer items-center gap-2 rounded-xl bg-white px-2 text-xs sm:col-span-3 dark:bg-zinc-800">
                                    <input
                                        type="checkbox"
                                        checked={variant.includesAdjustableBase ?? false}
                                        onChange={(e) =>
                                            setVariant(index, {
                                                includesAdjustableBase: e.target.checked,
                                            })
                                        }
                                        className="h-5 w-5 accent-sky-600"
                                    />
                                    <span>Includes adjustable base</span>
                                </label>

                                <button
                                    type="button"
                                    onClick={() => removeVariant(index)}
                                    aria-label="Remove size"
                                    className="flex h-12 items-center justify-center rounded-xl text-red-700
                                        hover:bg-red-100 sm:col-span-1 dark:text-red-400 dark:hover:bg-red-950/40"
                                >
                                    <Icon icon="fa-solid fa-trash" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>

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
                                    <label className="flex min-w-[10rem] flex-1 cursor-pointer items-center gap-3">
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
