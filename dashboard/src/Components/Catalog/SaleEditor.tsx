import { PickSaleMode, SaleModes, SaleModeText } from "@shared/Lib/CatalogDrafts";
import type { SaleDraft } from "@shared/Lib/CatalogDrafts";

type Props = {
    draft: SaleDraft;
    onChange: (draft: SaleDraft) => void;
    /** For a size: offer "Same as the item". */
    allowFollow?: boolean;
    /** What the size would follow, for its label, e.g. "20% off". */
    followLabel?: string;
    /** The follow button's name, e.g. "Same as option" for a delivery choice. */
    followName?: string;
    label?: string;
};

/**
 * Picks a sale: none, a percent off, or a fixed amount off each item. For a single size it can
 * also follow the product's sale, which it does unless told otherwise.
 */
const SaleEditor = ({
    draft,
    onChange,
    allowFollow = false,
    followLabel,
    followName = "Same as item",
    label = "Sale",
}: Props) => {
    const shown = SaleModes.filter((m) => allowFollow || m.mode !== "follow");

    return (
        <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {label}
            </span>
            <div className="flex flex-wrap items-center gap-2">
                <div
                    role="radiogroup"
                    aria-label={label}
                    className="inline-flex overflow-hidden rounded-xl border border-zinc-300 dark:border-zinc-600"
                >
                    {shown.map((m) => (
                        <button
                            key={m.mode}
                            type="button"
                            role="radio"
                            aria-checked={draft.mode === m.mode}
                            onClick={() => onChange(PickSaleMode(draft, m.mode))}
                            className={`min-h-[40px] px-3 text-sm font-semibold transition-colors ${
                                draft.mode === m.mode
                                    ? "bg-sky-700 text-white dark:bg-sky-600"
                                    : "bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                            }`}
                        >
                            {SaleModeText(m.mode, followName, followLabel)}
                        </button>
                    ))}
                </div>
                {(draft.mode === "percent" || draft.mode === "amount") && (
                    <label className="flex items-center gap-1">
                        {draft.mode === "amount" && (
                            <span className="text-sm font-semibold">$</span>
                        )}
                        <input
                            value={draft.text}
                            onChange={(e) => onChange({ ...draft, text: e.target.value })}
                            inputMode="decimal"
                            aria-label={
                                draft.mode === "percent"
                                    ? `${label} percent off`
                                    : `${label} amount off`
                            }
                            placeholder={draft.mode === "percent" ? "20" : "300"}
                            className="min-h-[40px] w-24 rounded-lg border border-zinc-300 bg-white px-2 text-base
                                dark:border-zinc-600 dark:bg-zinc-800"
                        />
                        {draft.mode === "percent" && (
                            <span className="text-sm font-semibold">%</span>
                        )}
                    </label>
                )}
            </div>
        </div>
    );
};

export default SaleEditor;
