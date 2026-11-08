import Button from "../Elements/Button";
import Modal from "../Elements/Modal";
import TabButton from "../Elements/TabButton";
import TextField from "../Elements/TextField";
import { useProductBundlePicker } from "@shared/Hooks/useProductBundlePicker";
import { VariantLabel } from "@shared/Lib/Catalog";
import type { BundlePick } from "@shared/Lib/ProductDraft";
import type { Product } from "@shared/Models/Product";

type Props = {
    catalog: Product[];
    excludeProductId?: number;
    size?: string;
    configuration?: string | null;
    onPick: (pick: BundlePick) => void;
    onClose: () => void;
};

/**
 * Picks an existing catalog item to include in a bundle - for example the IMC61 base that comes
 * with an Agility 3000 set. Bases are shown first because that is the usual case. By default the
 * pick is repeated on every other size of the same configuration, matched by size, so setting up
 * a mattress's four IMC61 sizes is one choice rather than four.
 */
const BundlePickerModal = ({
    catalog,
    excludeProductId,
    size,
    configuration,
    onPick,
    onClose,
}: Props) => {
    const picker = useProductBundlePicker(catalog, excludeProductId, size, onPick, onClose);
    const { product, variantId, filtered } = picker;

    return (
        <Modal
            title={product ? `Include ${product.name}` : "Include an item in this bundle"}
            onClose={onClose}
            wide
            footer={
                product ? (
                    <>
                        <Button
                            text="Back"
                            icon="fa-solid fa-arrow-left"
                            onClick={picker.unchoose}
                            className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                        />
                        <Button
                            text="Include"
                            icon="fa-solid fa-plus"
                            onClick={picker.add}
                            className="bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                        />
                    </>
                ) : undefined
            }
        >
            {!product ? (
                <>
                    <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
                        {picker.categories.map((c) => (
                            <TabButton
                                key={c}
                                text={c}
                                active={picker.tab === c}
                                onClick={() => picker.setTab(c)}
                            />
                        ))}
                    </div>
                    <TextField
                        label="Search"
                        value={picker.search}
                        onChange={picker.setSearch}
                        placeholder="Name or brand"
                        className="mb-3"
                    />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {filtered.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => picker.choose(p)}
                                className="flex min-h-[60px] flex-col items-start justify-center rounded-xl bg-zinc-100 px-4 py-2
                                    text-left hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                            >
                                <span className="font-semibold">{p.name}</span>
                                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {p.brand} &middot; {p.variants?.length} size
                                    {p.variants?.length === 1 ? "" : "s"}
                                </span>
                            </button>
                        ))}
                        {filtered.length === 0 && (
                            <p className="col-span-full py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                                Nothing here to include.
                            </p>
                        )}
                    </div>
                </>
            ) : (
                <div className="space-y-4">
                    <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Size
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {(product.variants ?? []).map((v) => (
                                <button
                                    key={v.id}
                                    type="button"
                                    onClick={() => picker.setVariantId(v.id ?? null)}
                                    className={`min-h-[48px] rounded-xl px-4 text-sm font-semibold ${
                                        v.id === variantId
                                            ? "bg-sky-700 text-white dark:bg-sky-600"
                                            : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                                    }`}
                                >
                                    {VariantLabel(v)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-end gap-4">
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                Quantity per bundle
                            </span>
                            <div className="flex items-center gap-2">
                                <Button
                                    icon="fa-solid fa-minus"
                                    onClick={() => picker.setQuantity((q) => Math.max(1, q - 1))}
                                    className="bg-zinc-500 px-4 hover:bg-zinc-600"
                                />
                                <span className="min-w-[3ch] text-center text-xl font-bold tabular-nums">
                                    {picker.quantity}
                                </span>
                                <Button
                                    icon="fa-solid fa-plus"
                                    onClick={() => picker.setQuantity((q) => Math.min(20, q + 1))}
                                    className="bg-zinc-500 px-4 hover:bg-zinc-600"
                                />
                            </div>
                        </label>

                        <label className="flex min-h-[48px] flex-1 cursor-pointer items-center gap-3 rounded-xl bg-zinc-100 px-3 dark:bg-zinc-700">
                            <input
                                type="checkbox"
                                checked={picker.matchSizes}
                                onChange={(e) => picker.setMatchSizes(e.target.checked)}
                                className="h-5 w-5 accent-sky-600"
                            />
                            <span className="text-sm">
                                Also include it on every other size
                                {configuration ? ` of "${configuration}"` : ""}, matching sizes
                            </span>
                        </label>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default BundlePickerModal;
