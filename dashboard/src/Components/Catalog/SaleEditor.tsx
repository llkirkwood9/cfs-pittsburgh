import { ParseMoney } from "../../Lib/ModelHelpers";

/** How a sale is set: none, a percent off, a fixed amount off each item - or, for a size, the product's. */
export type SaleMode = "none" | "percent" | "amount" | "follow";

/** A sale being edited: its mode and the number typed. */
export type SaleDraft = { mode: SaleMode; text: string };

/**
 * A sale as the editor shows it.
 * @param percent Percent off, if any.
 * @param amount Amount off, if any.
 * @param follow For a size: whether it follows the product's sale.
 * @returns The draft.
 */
export const ToSaleDraft = (
    percent?: number | null,
    amount?: number | null,
    follow = false
): SaleDraft =>
    follow
        ? { mode: "follow", text: "" }
        : (percent ?? 0) > 0
          ? { mode: "percent", text: String(percent) }
          : (amount ?? 0) > 0
            ? { mode: "amount", text: String(amount) }
            : { mode: "none", text: "" };

/**
 * A sale draft as saved: percent and amount (0 clears).
 * @param draft The draft.
 * @returns Percent and amount.
 */
export const FromSaleDraft = (draft: SaleDraft): { percent: number; amount: number } => {
    const value = ParseMoney(draft.text) ?? 0;
    return {
        percent: draft.mode === "percent" ? value : 0,
        amount: draft.mode === "amount" ? value : 0,
    };
};

/**
 * Why a sale draft can't be saved, or null when it's fine.
 * @param draft The draft.
 * @returns A message, or null.
 */
export const SaleProblem = (draft: SaleDraft): string | null => {
    if (draft.mode !== "percent" && draft.mode !== "amount") return null;
    const value = ParseMoney(draft.text);
    if (value === null || value <= 0) return "Enter how much the sale takes off.";
    if (draft.mode === "percent" && value > 100) return "A sale can take off at most 100%.";
    return null;
};

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

const modes: { mode: SaleMode; label: string }[] = [
    { mode: "follow", label: "Same as item" },
    { mode: "none", label: "No sale" },
    { mode: "percent", label: "% off" },
    { mode: "amount", label: "$ off" },
];

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
    const shown = modes.filter((m) => allowFollow || m.mode !== "follow");

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
                            onClick={() =>
                                onChange({
                                    mode: m.mode,
                                    text: m.mode === draft.mode ? draft.text : "",
                                })
                            }
                            className={`min-h-[40px] px-3 text-sm font-semibold transition-colors ${
                                draft.mode === m.mode
                                    ? "bg-sky-700 text-white dark:bg-sky-600"
                                    : "bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                            }`}
                        >
                            {m.mode === "follow"
                                ? followLabel
                                    ? `${followName} (${followLabel})`
                                    : followName
                                : m.label}
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
