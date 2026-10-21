import { useEffect, useMemo, useState } from "react";
import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import { Toast } from "../../Lib/Toast";
import type { Product } from "../../Models/Product";
import type { Territory } from "../../Models/Territory";
import { CopyProduct, GetProducts } from "../../Services/ProductServices";

type Props = {
    /** The other territories whose catalogs an item can be copied from. */
    territories: Territory[];
    /** The copy was made, in the territory in view. */
    onCopied: (product: Product) => void;
};

/**
 * At the top of a new product: start from an item in another territory's catalog instead of
 * filling everything in. The copy brings its sizes, prices, sales, selections, notes and warranty;
 * delivery options are matched by name (and added when this territory has none of that name),
 * and bundled items this territory doesn't sell are left out. Stock isn't copied.
 */
const CopyFromTerritory = ({ territories, onCopied }: Props) => {
    const [territoryId, setTerritoryId] = useState<number | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [productId, setProductId] = useState<number | null>(null);
    const [copying, setCopying] = useState<boolean>(false);

    useEffect(() => {
        if (territoryId == null) return;
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            const found = await GetProducts(true, territoryId);
            if (cancelled) return;
            setProducts(found);
            setLoading(false);
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [territoryId]);

    const sorted = useMemo(
        () =>
            [...products].sort(
                (a, b) =>
                    (a.category ?? "").localeCompare(b.category ?? "") ||
                    (a.name ?? "").localeCompare(b.name ?? "")
            ),
        [products]
    );

    const handleCopy = async () => {
        if (productId == null) return Toast.Warning("Pick the item to copy.");
        setCopying(true);
        const result = await CopyProduct(productId);
        setCopying(false);
        if (!result?.product) return;

        Toast.Success(`${result.product.name} copied into this catalog.`);
        for (const note of result.notes ?? []) Toast.Info(note);
        onCopied(result.product);
    };

    return (
        <div className="rounded-xl border border-dashed border-sky-300 bg-sky-50 p-3 dark:border-sky-800 dark:bg-sky-950/30">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-sky-900 dark:text-sky-200">
                <Icon icon="fa-solid fa-copy" />
                Copy an item from another territory
            </p>
            <div className="flex flex-wrap items-end gap-2">
                <label className="flex min-w-40 flex-1 flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Territory
                    </span>
                    <select
                        value={territoryId ?? ""}
                        onChange={(e) => {
                            setTerritoryId(e.target.value ? Number(e.target.value) : null);
                            setProductId(null);
                            setProducts([]);
                        }}
                        className="min-h-[48px] rounded-xl border border-zinc-300 bg-white px-3 text-base
                            dark:border-zinc-600 dark:bg-zinc-800 dark:scheme-dark"
                    >
                        <option value="">Pick a territory...</option>
                        {territories.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex min-w-52 flex-[2] flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Item
                    </span>
                    <select
                        value={productId ?? ""}
                        disabled={territoryId == null || loading}
                        onChange={(e) => setProductId(e.target.value ? Number(e.target.value) : null)}
                        className="min-h-[48px] rounded-xl border border-zinc-300 bg-white px-3 text-base disabled:opacity-60
                            dark:border-zinc-600 dark:bg-zinc-800 dark:scheme-dark"
                    >
                        <option value="">
                            {loading ? "Loading..." : territoryId == null ? "Pick a territory first" : "Pick an item..."}
                        </option>
                        {sorted.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.category} - {p.brand ? `${p.brand} ` : ""}
                                {p.name}
                                {p.isActive === false ? " (archived)" : ""}
                            </option>
                        ))}
                    </select>
                </label>
                <Button
                    text="Copy"
                    icon="fa-solid fa-copy"
                    onClick={handleCopy}
                    loading={copying}
                    disabled={productId == null}
                />
            </div>
        </div>
    );
};

export default CopyFromTerritory;
