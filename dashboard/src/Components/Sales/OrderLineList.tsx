import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import { FormatCurrency, SortLinesForPrint } from "../../Lib/ModelHelpers";
import type { OrderLine } from "../../Models/OrderLine";

type Props = {
    lines: OrderLine[];
    readOnly?: boolean;
    onEdit?: (line: OrderLine) => void;
    onAddService?: (line: OrderLine) => void;
    onRemove?: (line: OrderLine) => void;
};

/**
 * The product grid as the rep sees it on the floor: one card per line, delivery charges indented
 * under the item they belong to, exactly the way they read on the paper sheet.
 */
const OrderLineList = ({ lines, readOnly = false, onEdit, onAddService, onRemove }: Props) => {
    const ordered = SortLinesForPrint(lines);

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

                return (
                    <li
                        key={line.id}
                        className={`rounded-xl bg-white p-3 shadow-sm transition-colors dark:bg-zinc-800 ${
                            isService ? "ml-4 border-l-4 border-sky-500/50" : ""
                        }`}
                    >
                        <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-semibold text-zinc-900 dark:text-zinc-100">
                                    {line.description}
                                </p>
                                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                                    {line.brand && <span>{line.brand}</span>}
                                    {line.size && <span>{line.size}</span>}
                                    <span>Qty {line.quantity}</span>
                                    <span>{FormatCurrency(line.unitPrice)} ea</span>
                                    {(line.discountPercent ?? 0) > 0 && (
                                        <span className="rounded bg-green-100 px-1.5 py-0.5 font-semibold text-green-800 dark:bg-green-900/50 dark:text-green-300">
                                            -{line.discountPercent}%
                                        </span>
                                    )}
                                    {line.takeWith && (
                                        <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                                            Take with
                                        </span>
                                    )}
                                    {line.includesAdjustableBase && (
                                        <span className="rounded bg-violet-100 px-1.5 py-0.5 font-semibold text-violet-800 dark:bg-violet-900/50 dark:text-violet-300">
                                            Incl. base
                                        </span>
                                    )}
                                </p>
                            </div>

                            <div className="shrink-0 text-right">
                                <p className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                                    {FormatCurrency(line.lineTotal)}
                                </p>
                            </div>
                        </div>

                        {!readOnly && (
                            <div className="mt-2 flex flex-wrap gap-2">
                                {onEdit && (
                                    <Button
                                        text="Edit"
                                        icon="fa-solid fa-pen"
                                        onClick={() => onEdit(line)}
                                        className="min-h-[40px] bg-zinc-500 px-3 text-sm hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                                    />
                                )}
                                {onAddService && !isService && (
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
