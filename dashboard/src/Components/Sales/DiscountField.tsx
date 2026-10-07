import { CleanDiscount, type Discount } from "../../Lib/Pricing";
import { ParseMoney } from "../../Lib/ModelHelpers";

export type DiscountMode = "percent" | "amount";

/**
 * The discount typed into a DiscountField, tidied the way the server stores it.
 * @param mode Percent or amount.
 * @param text What was typed.
 * @returns The discount.
 */
export const DiscountFrom = (mode: DiscountMode, text: string): Discount =>
    mode === "percent"
        ? CleanDiscount(ParseMoney(text), null)
        : CleanDiscount(null, ParseMoney(text));

/**
 * Why a typed discount can't be used, or null when it's fine (blank is fine).
 * @param mode Percent or amount.
 * @param text What was typed.
 * @param what What the discount is on, for the message, e.g. "shipping".
 * @returns A message, or null.
 */
export const DiscountProblem = (mode: DiscountMode, text: string, what = ""): string | null => {
    if (text.trim() === "") return null;
    const value = ParseMoney(text);
    const on = what ? ` ${what}` : "";
    if (value === null || value < 0) return `Enter the${on} discount as a number.`;
    if (mode === "percent" && value > 100)
        return `The${on} discount must be between 0 and 100 percent.`;
    return null;
};

type Props = {
    label: string;
    mode: DiscountMode;
    onMode: (mode: DiscountMode) => void;
    text: string;
    onText: (text: string) => void;
    /** Starts the input's accessible name, e.g. "Shipping discount". */
    name: string;
};

/**
 * A discount as a percent or a dollar amount: a % / $ switch beside the number.
 */
const DiscountField = ({ label, mode, onMode, text, onText, name }: Props) => (
    <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {label}
        </span>
        <div className="flex gap-2">
            <div
                role="radiogroup"
                aria-label={`${name} type`}
                className="inline-flex shrink-0 overflow-hidden rounded-xl border border-zinc-300 dark:border-zinc-600"
            >
                {(["percent", "amount"] as const).map((m) => (
                    <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={mode === m}
                        aria-label={`${name} ${m === "percent" ? "%" : "$"}`}
                        onClick={() => onMode(m)}
                        className={`min-h-[48px] w-11 text-base font-bold ${
                            mode === m
                                ? "bg-sky-700 text-white dark:bg-sky-600"
                                : "bg-white text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                        }`}
                    >
                        {m === "percent" ? "%" : "$"}
                    </button>
                ))}
            </div>
            <input
                value={text}
                onChange={(e) => onText(e.target.value)}
                inputMode="decimal"
                placeholder="0"
                aria-label={mode === "percent" ? `${name} percent` : `${name} amount`}
                className="min-h-[48px] w-full min-w-0 rounded-xl border border-zinc-300 bg-white px-3 text-base
                    text-zinc-900 outline-none focus:border-sky-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
        </div>
    </div>
);

export default DiscountField;
