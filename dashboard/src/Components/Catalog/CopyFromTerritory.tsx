import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import { useProductCopy } from "@shared/Hooks/useProductCopy";
import type { Product } from "@shared/Models/Product";
import type { Territory } from "@shared/Models/Territory";

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
    const copier = useProductCopy(onCopied);
    const { territoryId, productId } = copier;

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
                        onChange={(e) =>
                            copier.pickTerritory(e.target.value ? Number(e.target.value) : null)
                        }
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
                        disabled={territoryId == null || copier.loading}
                        onChange={(e) =>
                            copier.setProductId(e.target.value ? Number(e.target.value) : null)
                        }
                        className="min-h-[48px] rounded-xl border border-zinc-300 bg-white px-3 text-base disabled:opacity-60
                            dark:border-zinc-600 dark:bg-zinc-800 dark:scheme-dark"
                    >
                        <option value="">{copier.itemPrompt}</option>
                        {copier.products.map((p) => (
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
                    onClick={copier.copy}
                    loading={copier.copying}
                    disabled={productId == null}
                />
            </div>
        </div>
    );
};

export default CopyFromTerritory;
