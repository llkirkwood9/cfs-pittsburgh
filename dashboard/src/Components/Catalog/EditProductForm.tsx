import BundlePickerModal from "./BundlePickerModal";
import CopyFromTerritory from "./CopyFromTerritory";
import OptionsEditor from "./OptionsEditor";
import SaleEditor from "./SaleEditor";
import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import Modal from "../Elements/Modal";
import TextField from "../Elements/TextField";
import { useProductDraft } from "@shared/Hooks/useProductDraft";
import { SaleOffText } from "@shared/Lib/CatalogDrafts";
import { CleanDiscount } from "@shared/Lib/Pricing";
import type { DeliveryOption } from "@shared/Models/DeliveryOption";
import type { Product, ProductCategory } from "@shared/Models/Product";
import type { Territory } from "@shared/Models/Territory";
import { Limits } from "@shared/Lib/Limits";

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
    const form = useProductDraft(product, onSave, onClose);
    const { draft, change, setVariant, bundlingIndex } = form;

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
                        onClick={form.save}
                        loading={form.saving}
                    />
                </>
            }
        >
            <div className="space-y-5">
                {!product.id && copySources.length > 0 && onCopied && (
                    <CopyFromTerritory territories={copySources} onCopied={onCopied} />
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <TextField
                        label="Name"
                        value={draft.name}
                        onChange={(value) => change({ name: value })}
                        maxLength={Limits.productName}
                    />
                    <TextField
                        label="Brand"
                        value={draft.brand}
                        onChange={(value) => change({ brand: value })}
                        maxLength={Limits.brand}
                    />

                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Category
                        </span>
                        <select
                            value={draft.category}
                            onChange={(e) =>
                                change({ category: e.target.value as ProductCategory })
                            }
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
                            checked={draft.isActive}
                            onChange={(e) => change({ isActive: e.target.checked })}
                            className="h-5 w-5 accent-sky-600"
                        />
                        <span className="text-sm font-medium">Offered on the floor</span>
                    </label>

                    <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl bg-zinc-100 px-3 py-2 sm:col-span-2 dark:bg-zinc-700">
                        <input
                            type="checkbox"
                            checked={draft.trackInventory}
                            onChange={(e) => change({ trackInventory: e.target.checked })}
                            className="h-5 w-5 accent-sky-600"
                        />
                        <span className="text-sm">
                            <span className="font-medium">Track inventory</span>
                        </span>
                    </label>

                    {/* Decides whether the customer initials the warranty statement. */}
                    <label className="flex min-h-[48px] cursor-pointer items-center gap-3 self-end rounded-xl bg-zinc-100 px-3 py-2 dark:bg-zinc-700">
                        <input
                            type="checkbox"
                            checked={form.hasWarranty}
                            onChange={(e) => change({ warrantyChoice: e.target.checked })}
                            className="h-5 w-5 accent-sky-600"
                        />
                        <span className="text-sm font-medium">Has a manufacturer warranty</span>
                    </label>
                    <TextField
                        label="Warranty length"
                        value={draft.warrantyLength}
                        onChange={(value) => change({ warrantyLength: value })}
                        maxLength={Limits.warrantyLength}
                        placeholder="ex. 10 years"
                        disabled={!form.hasWarranty}
                    />

                    <TextField
                        label="Notes shown to the rep"
                        value={draft.notes}
                        onChange={(value) => change({ notes: value })}
                        className="sm:col-span-2"
                        maxLength={Limits.productNotes}
                        placeholder="ex. Sale, warranty info"
                    />

                    <div className="sm:col-span-2">
                        <SaleEditor
                            label="Sale on every size"
                            draft={draft.sale}
                            onChange={(value) => change({ sale: value })}
                        />
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
                            onClick={form.addVariant}
                            className="min-h-[40px] px-3 text-sm"
                        />
                    </div>

                    <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                        Leave a price blank for Inquire.
                    </p>

                    <ul className="space-y-2">
                        {draft.variants.map((variant, index) => (
                            <li
                                key={variant.id ?? `new-${index}`}
                                className="grid grid-cols-2 items-end gap-2 rounded-xl bg-zinc-100 p-3 sm:grid-cols-12 dark:bg-zinc-700"
                            >
                                <TextField
                                    label="Size"
                                    value={variant.size ?? ""}
                                    onChange={(value) => setVariant(index, { size: value })}
                                    className="sm:col-span-3"
                                    maxLength={Limits.size}
                                />
                                <TextField
                                    label="Configuration"
                                    value={variant.configuration ?? ""}
                                    onChange={(value) =>
                                        setVariant(index, { configuration: value })
                                    }
                                    className="sm:col-span-5"
                                    maxLength={Limits.configuration}
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
                                    onClick={() => form.removeVariant(index)}
                                    aria-label="Remove size"
                                    className="flex h-12 items-center justify-center rounded-xl text-red-700
                                        hover:bg-red-100 sm:col-span-1 dark:text-red-400 dark:hover:bg-red-950/40"
                                >
                                    <Icon icon="fa-solid fa-trash" />
                                </button>

                                <TextField
                                    label="Note for the rep"
                                    value={variant.notes ?? ""}
                                    onChange={(value) => setVariant(index, { notes: value })}
                                    className="col-span-full"
                                    maxLength={Limits.sizeNotes}
                                    placeholder="ex. Not compressed"
                                />

                                <div className="col-span-full">
                                    <SaleEditor
                                        label="Sale for this size"
                                        draft={variant.sale}
                                        onChange={(next) => setVariant(index, { sale: next })}
                                        allowFollow
                                        followLabel={form.itemSaleLabel}
                                    />
                                </div>

                                {draft.trackInventory && (
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
                                                    form.removeComponent(
                                                        index,
                                                        c.componentVariantId
                                                    )
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
                                        onClick={() => form.setBundlingIndex(index)}
                                        className="min-h-[36px] bg-violet-700 px-3 text-sm hover:bg-violet-800 dark:bg-violet-600 dark:hover:bg-violet-700"
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>

                <OptionsEditor
                    options={draft.options}
                    onChange={(value) => change({ options: value })}
                    trackInventory={draft.trackInventory}
                />

                {bundlingIndex !== null && (
                    <BundlePickerModal
                        catalog={catalog}
                        excludeProductId={product.id}
                        size={draft.variants[bundlingIndex]?.size}
                        configuration={draft.variants[bundlingIndex]?.configuration}
                        onPick={(pick) => form.applyBundlePick(bundlingIndex, pick)}
                        onClose={() => form.setBundlingIndex(null)}
                    />
                )}

                <section>
                    <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Delivery options for this product
                    </h3>
                    <ul className="space-y-2">
                        {deliveryOptions.length === 0 && (
                            <li className="text-sm text-zinc-500 dark:text-zinc-400">
                                This territory has no delivery options yet.
                            </li>
                        )}
                        {deliveryOptions.map((option) => {
                            const selected = draft.delivery.find(
                                (d) => d.deliveryOptionId === option.id
                            );

                            return (
                                <li
                                    key={option.id}
                                    className="flex flex-wrap items-center gap-3 rounded-xl bg-zinc-100 p-3 dark:bg-zinc-700"
                                >
                                    <label className="flex min-w-40 flex-1 cursor-pointer items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(selected)}
                                            onChange={() => form.toggleDelivery(option)}
                                            className="h-5 w-5 accent-sky-600"
                                        />
                                        <span className="text-sm font-medium">{option.name}</span>
                                    </label>

                                    {selected && (
                                        <>
                                            <input
                                                value={form.overrideText(option.id ?? 0)}
                                                onChange={(e) =>
                                                    option.id &&
                                                    form.setDeliveryOverride(
                                                        option.id,
                                                        e.target.value
                                                    )
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
                                                        option.id &&
                                                        form.setDefaultDelivery(option.id)
                                                    }
                                                    className="h-4 w-4 accent-sky-600"
                                                />
                                                Default
                                            </label>
                                            <div className="w-full">
                                                <SaleEditor
                                                    draft={form.deliverySale(option.id)}
                                                    onChange={(sale) =>
                                                        form.setDeliverySale(option.id, sale)
                                                    }
                                                    allowFollow
                                                    followName="Same as option"
                                                    followLabel={SaleOffText(
                                                        CleanDiscount(
                                                            option.saleDiscountPercent,
                                                            option.saleDiscountAmount
                                                        )
                                                    )}
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
