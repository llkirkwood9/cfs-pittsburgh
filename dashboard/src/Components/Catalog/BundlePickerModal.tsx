import { useMemo, useState } from "react";
import Button from "../Elements/Button";
import Modal from "../Elements/Modal";
import TabButton from "../Elements/TabButton";
import TextField from "../Elements/TextField";
import { Toast } from "../../Lib/Toast";
import type { Product, ProductCategory } from "../../Models/Product";
import type { ProductVariant } from "../../Models/ProductVariant";

export type BundlePick = {
    product: Product;
    variant: ProductVariant;
    quantity: number;
    matchSizes: boolean;
};

type Props = {
    catalog: Product[];
    excludeProductId?: number;
    size?: string;
    configuration?: string | null;
    onPick: (pick: BundlePick) => void;
    onClose: () => void;
};

const categoryLabels: Record<ProductCategory, string> = {
    AdjustableBase: "Bases",
    Mattress: "Mattresses",
    Pillow: "Pillows",
    Sheets: "Sheets",
    MattressProtector: "Protectors",
    Frame: "Frames",
    BeanBagChair: "Bean Bags",
    Misc: "Other",
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
    // Bundles cannot contain bundles, so only items sold on their own are offered.
    const choices = useMemo(
        () =>
            catalog
                .filter((p) => p.id !== excludeProductId)
                .map((p) => ({
                    ...p,
                    variants: (p.variants ?? []).filter((v) => (v.components ?? []).length === 0),
                }))
                .filter((p) => p.variants.length > 0),
        [catalog, excludeProductId]
    );

    const categories = useMemo(() => {
        const present = new Set(choices.map((p) => p.category));
        return (Object.keys(categoryLabels) as ProductCategory[]).filter((c) => present.has(c));
    }, [choices]);

    const [tab, setTab] = useState<ProductCategory>(
        categories.includes("AdjustableBase") ? "AdjustableBase" : (categories[0] ?? "Misc")
    );
    const [search, setSearch] = useState<string>("");
    const [product, setProduct] = useState<Product | null>(null);
    const [variantId, setVariantId] = useState<number | null>(null);
    const [quantity, setQuantity] = useState<number>(1);
    const [matchSizes, setMatchSizes] = useState<boolean>(true);

    const filtered = choices.filter((p) => {
        if (p.category !== tab) return false;
        const term = search.trim().toLowerCase();
        return (
            !term ||
            (p.name ?? "").toLowerCase().includes(term) ||
            (p.brand ?? "").toLowerCase().includes(term)
        );
    });

    const choose = (picked: Product) => {
        setProduct(picked);
        // Start on the same size as the bundle, which is nearly always the right one.
        const sameSize = picked.variants?.find(
            (v) => (v.size ?? "").toLowerCase() === (size ?? "").toLowerCase()
        );
        setVariantId(sameSize?.id ?? picked.variants?.[0]?.id ?? null);
    };

    const handleAdd = () => {
        const variant = product?.variants?.find((v) => v.id === variantId);
        if (!product || !variant) return Toast.Warning("Pick a size.");
        onPick({ product, variant, quantity, matchSizes });
        onClose();
    };

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
                            onClick={() => setProduct(null)}
                            className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                        />
                        <Button
                            text="Include"
                            icon="fa-solid fa-plus"
                            onClick={handleAdd}
                            className="bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                        />
                    </>
                ) : undefined
            }
        >
            {!product ? (
                <>
                    <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
                        {categories.map((c) => (
                            <TabButton
                                key={c}
                                text={categoryLabels[c]}
                                active={tab === c}
                                onClick={() => setTab(c)}
                            />
                        ))}
                    </div>
                    <TextField
                        label="Search"
                        value={search}
                        onChange={setSearch}
                        placeholder="Name or brand"
                        className="mb-3"
                    />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {filtered.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => choose(p)}
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
                                    onClick={() => setVariantId(v.id ?? null)}
                                    className={`min-h-[48px] rounded-xl px-4 text-sm font-semibold ${
                                        v.id === variantId
                                            ? "bg-sky-700 text-white dark:bg-sky-600"
                                            : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                                    }`}
                                >
                                    {v.configuration ? `${v.size} - ${v.configuration}` : v.size}
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
                                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                                    className="bg-zinc-500 px-4 hover:bg-zinc-600"
                                />
                                <span className="min-w-[3ch] text-center text-xl font-bold tabular-nums">
                                    {quantity}
                                </span>
                                <Button
                                    icon="fa-solid fa-plus"
                                    onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                                    className="bg-zinc-500 px-4 hover:bg-zinc-600"
                                />
                            </div>
                        </label>

                        <label className="flex min-h-[48px] flex-1 cursor-pointer items-center gap-3 rounded-xl bg-zinc-100 px-3 dark:bg-zinc-700">
                            <input
                                type="checkbox"
                                checked={matchSizes}
                                onChange={(e) => setMatchSizes(e.target.checked)}
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
