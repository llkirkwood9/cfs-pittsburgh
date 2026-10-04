import { FormatCurrency } from "../../Lib/ModelHelpers";
import type { ProductOption } from "../../Models/ProductOption";

type Props = {
    option: ProductOption;
    picked?: number;
    onPick: (choiceId: number) => void;
    /** Units on hand if this choice were picked; null when not counted (or not yet knowable). */
    stockFor?: (choiceId: number) => number | null;
    /** Leave out price changes - an included item is free whatever its choice. */
    hidePrice?: boolean;
};

/**
 * One selection, such as Color, as a row of chips - like the sizes, so it works with a thumb.
 * Each chip shows any price change, and the stock for that choice when it is counted.
 */
const ChoicePicker = ({ option, picked, onPick, stockFor, hidePrice = false }: Props) => {
    const required = option.isRequired || option.tracksStock;

    return (
        <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {option.name}
                {!required && <span className="ml-1 font-normal normal-case">(optional)</span>}
            </p>
            <div role="radiogroup" aria-label={option.name} className="flex flex-wrap gap-2">
                {(option.choices ?? []).map((choice) => {
                    const stock = stockFor?.(choice.id ?? 0) ?? null;
                    const active = picked === choice.id;
                    return (
                        <button
                            key={choice.id}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => onPick(choice.id ?? 0)}
                            className={`flex min-h-[48px] flex-col items-start justify-center rounded-xl px-4 py-1 text-left text-sm font-semibold transition-colors ${
                                active
                                    ? "bg-sky-700 text-white dark:bg-sky-600"
                                    : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                            }`}
                        >
                            <span>
                                {choice.name}
                                {!hidePrice && (choice.priceAdjustment ?? 0) !== 0 && (
                                    <span className="ml-1 font-normal">
                                        {(choice.priceAdjustment ?? 0) > 0 ? "+" : "-"}
                                        {FormatCurrency(Math.abs(choice.priceAdjustment ?? 0))}
                                    </span>
                                )}
                            </span>
                            {stock !== null && (
                                <span className="text-[11px] font-medium opacity-90">
                                    {stock > 0 ? `${stock} in stock` : "Out of stock"}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default ChoicePicker;
