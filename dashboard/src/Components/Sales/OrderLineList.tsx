import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import { FormatCurrency, PrintsOnSalesSheet, SortLinesForPrint } from "../../Lib/ModelHelpers";
import type { OrderLine } from "../../Models/OrderLine";

type Props = {
    lines: OrderLine[];
    readOnly?: boolean;
    onEdit?: (line: OrderLine) => void;
    onAddService?: (line: OrderLine) => void;
    onRemove?: (line: OrderLine) => void;
    /** Changes a line's quantity in place, without opening the editor. */
    onQuantity?: (line: OrderLine, quantity: number) => void;
};

/**
 * The product grid as the rep sees it on the floor: one card per line, delivery charges indented
 * under the item they belong to, exactly the way they read on the paper sheet.
 */
const OrderLineList = ({
    lines,
    readOnly = false,
    onEdit,
    onAddService,
    onRemove,
    onQuantity,
}: Props) => {
    const ordered = SortLinesForPrint(lines);

    // Sets sold since the base got its own row do not need the badge as well; older orders still do.
    const hasBaseRow = new Set(
        lines.filter((l) => l.lineType === "Included").map((l) => l.parentLineId)
    );

    if (ordered.length === 0) {
        return (
            <div className="rounded-xl border-2 border-dashed border-zinc-300 py-10 text-center dark:border-zinc-700">
                <Icon icon="fa-solid fa-cart-shopping" className="text-2xl text-zinc-400" />
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                    No items yet. Tap Add item to start the order.
                </p>
            </div>
        );
    }

    return (
        <ul className="space-y-2">
            {ordered.map((line) => {
                const isService = line.lineType === "Delivery";
                const isIncluded = line.lineType === "Included";
                const isChild = isService || isIncluded;

                return (
                    <li
                        key={line.id}
                        className={`rounded-xl bg-white p-3 shadow-sm transition-colors dark:bg-zinc-800 ${
                            isService
                                ? "ml-4 border-l-4 border-sky-500/50"
                                : isIncluded
                                  ? "ml-4 border-l-4 border-violet-500/50"
                                  : ""
                        }`}
                    >
                        <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                                <p className="break-words font-semibold text-zinc-900 dark:text-zinc-100">
                                    {isService && (
                                        <span className="mr-1 text-xs font-bold uppercase text-sky-700 dark:text-sky-400">
                                            Ship
                                        </span>
                                    )}
                                    {line.description}
                                </p>
                                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                                    {line.brand && <span>{line.brand}</span>}
                                    {line.size && <span>{line.size}</span>}
                                    {!isService && <span>Qty {line.quantity}</span>}
                                    {isIncluded ? (
                                        <span className="rounded bg-violet-100 px-1.5 py-0.5 font-semibold text-violet-800 dark:bg-violet-900/50 dark:text-violet-300">
                                            Included
                                        </span>
                                    ) : (
                                        <span>{FormatCurrency(line.unitPrice)} ea</span>
                                    )}
                                    {(line.discountPercent ?? 0) > 0 && (
                                        <span className="rounded bg-green-100 px-1.5 py-0.5 font-semibold text-green-800 dark:bg-green-900/50 dark:text-green-300">
                                            -{line.discountPercent}%
                                        </span>
                                    )}
                                    {!PrintsOnSalesSheet(line) && (
                                        <span className="rounded bg-zinc-200 px-1.5 py-0.5 font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
                                            Not on sales sheet
                                        </span>
                                    )}
                                    {line.takeWith && (
                                        <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                                            Take with
                                        </span>
                                    )}
                                    {line.includesAdjustableBase && !hasBaseRow.has(line.id) && (
                                        <span className="rounded bg-violet-100 px-1.5 py-0.5 font-semibold text-violet-800 dark:bg-violet-900/50 dark:text-violet-300">
                                            Incl. base
                                        </span>
                                    )}
                                </p>
                                {line.notes && (
                                    <p
                                        className="mt-1 flex gap-1.5 whitespace-pre-line break-words rounded-lg bg-amber-50 px-2 py-1 text-sm
                                        text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                                    >
                                        <Icon
                                            icon="fa-solid fa-note-sticky"
                                            className="mt-0.5 shrink-0 text-xs"
                                        />
                                        <span>{line.notes}</span>
                                    </p>
                                )}
                            </div>

                            <div className="shrink-0 text-right">
                                <p className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                                    {isIncluded ? "Incl." : FormatCurrency(line.lineTotal)}
                                </p>
                            </div>
                        </div>

                        {!readOnly && !isIncluded && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                {onQuantity && !isChild && (
                                    <div className="flex items-center rounded-xl bg-zinc-100 dark:bg-zinc-700">
                                        <button
                                            type="button"
                                            aria-label="One fewer"
                                            disabled={(line.quantity ?? 1) <= 1}
                                            onClick={() =>
                                                onQuantity(line, (line.quantity ?? 1) - 1)
                                            }
                                            className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-700
                                                hover:bg-zinc-200 disabled:opacity-30 dark:text-zinc-200 dark:hover:bg-zinc-600"
                                        >
                                            <Icon icon="fa-solid fa-minus" />
                                        </button>
                                        <span className="min-w-[2ch] text-center text-sm font-bold tabular-nums">
                                            {line.quantity ?? 1}
                                        </span>
                                        <button
                                            type="button"
                                            aria-label="One more"
                                            onClick={() =>
                                                onQuantity(line, (line.quantity ?? 1) + 1)
                                            }
                                            className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-700
                                                hover:bg-zinc-200 dark:text-zinc-200 dark:hover:bg-zinc-600"
                                        >
                                            <Icon icon="fa-solid fa-plus" />
                                        </button>
                                    </div>
                                )}
                                {onEdit && (
                                    <Button
                                        text="Edit"
                                        icon="fa-solid fa-pen"
                                        onClick={() => onEdit(line)}
                                        className="min-h-[40px] bg-zinc-500 px-3 text-sm hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                                    />
                                )}
                                {onAddService && !isChild && (
                                    <Button
                                        text="Add service"
                                        icon="fa-solid fa-truck"
                                        onClick={() => onAddService(line)}
                                        className="min-h-[40px] px-3 text-sm"
                                    />
                                )}
                                {onRemove && (
                                    <Button
                                        text="Remove"
                                        icon="fa-solid fa-trash"
                                        onClick={() => onRemove(line)}
                                        className="min-h-[40px] bg-red-700 px-3 text-sm hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700"
                                    />
                                )}
                            </div>
                        )}
                    </li>
                );
            })}
        </ul>
    );
};

export default OrderLineList;
