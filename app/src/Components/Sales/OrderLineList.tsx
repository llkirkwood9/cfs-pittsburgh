import { Pressable, View } from "react-native";
import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import Text from "../Elements/Text";
import { cx } from "../../Lib/ClassNames";
import { FormatCurrency, PrintsOnSalesSheet, SortLinesForPrint } from "../../Lib/ModelHelpers";
import { ChoicesText, CleanDiscount, DiscountText, HasDiscount } from "../../Lib/Pricing";
import type { OrderLine } from "../../Models/OrderLine";

type Props = {
    lines: OrderLine[];
    readOnly?: boolean;
    onEdit?: (line: OrderLine) => void;
    onAddService?: (line: OrderLine) => void;
    onAddUpcharge?: (line: OrderLine) => void;
    onRemove?: (line: OrderLine) => void;
    /** Changes a line's quantity in place, without opening the editor. */
    onQuantity?: (line: OrderLine, quantity: number) => void;
    /** Puts the items in a new order: every item line's id, in that order. */
    onReorder?: (itemIds: number[]) => void;
};

/** A small coloured label in a line's detail row. */
const Badge = ({ text, className }: { text: string; className: string }) => (
    <View className={cx("rounded px-1.5 py-0.5", className.split(" ").filter((c) => c.includes("bg-")).join(" "))}>
        <Text className={cx("text-xs font-semibold", className.split(" ").filter((c) => !c.includes("bg-")).join(" "))}>
            {text}
        </Text>
    </View>
);

/** A small round icon button: quantity and move arrows. */
const IconButton = ({
    icon,
    label,
    onPress,
    disabled = false,
}: {
    icon: string;
    label: string;
    onPress: () => void;
    disabled?: boolean;
}) => (
    <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        className={cx(
            "h-10 w-10 items-center justify-center rounded-xl active:bg-zinc-200 dark:active:bg-zinc-600",
            disabled && "opacity-30"
        )}
    >
        <Icon icon={icon} className="text-zinc-700 dark:text-zinc-200" />
    </Pressable>
);

/**
 * The product grid as the rep sees it on the floor: one card per line, delivery charges and
 * upcharges indented under the item they belong to, exactly the way they read on the paper sheet.
 */
const OrderLineList = ({
    lines,
    readOnly = false,
    onEdit,
    onAddService,
    onAddUpcharge,
    onRemove,
    onQuantity,
    onReorder,
}: Props) => {
    const ordered = SortLinesForPrint(lines);

    // The items in sales sheet order; each one's own rows move with it.
    const itemIds = ordered
        .filter((l) => !l.parentLineId || !lines.some((p) => p.id === l.parentLineId))
        .map((l) => l.id ?? 0);
    const move = (line: OrderLine, by: number) => {
        const ids = [...itemIds];
        const index = ids.indexOf(line.id ?? 0);
        ids.splice(index, 1);
        ids.splice(index + by, 0, line.id ?? 0);
        onReorder?.(ids);
    };

    // Sets sold since the base got its own row do not need the badge as well; older orders still do.
    const hasBaseRow = new Set(
        lines.filter((l) => l.lineType === "Included").map((l) => l.parentLineId)
    );

    if (ordered.length === 0) {
        return (
            <View className="items-center rounded-xl border-2 border-dashed border-zinc-300 py-10 dark:border-zinc-700">
                <Icon icon="fa-solid fa-cart-shopping" className="text-2xl text-zinc-400" />
                <Text className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                    No items yet. Tap Add item to start the order.
                </Text>
            </View>
        );
    }

    return (
        <View className="gap-2">
            {ordered.map((line) => {
                const isService = line.lineType === "Delivery";
                const isIncluded = line.lineType === "Included";
                const isUpcharge = line.lineType === "Upcharge";
                const isChild = isService || isIncluded || isUpcharge;
                const sale = CleanDiscount(line.saleDiscountPercent, line.saleDiscountAmount);
                const discount = CleanDiscount(line.discountPercent, line.discountAmount);
                const choices = ChoicesText(line.choices);
                const position = itemIds.indexOf(line.id ?? 0);

                return (
                    <View
                        key={line.id}
                        className={cx(
                            "rounded-xl bg-white p-3 shadow-sm dark:bg-zinc-800",
                            isService && "ml-4 border-l-4 border-sky-500/50",
                            isIncluded && "ml-4 border-l-4 border-violet-500/50",
                            isUpcharge && "ml-4 border-l-4 border-orange-500/50"
                        )}
                    >
                        <View className="flex-row items-start gap-3">
                            <View className="min-w-0 flex-1">
                                <Text className="font-semibold">
                                    {isService && (
                                        <Text className="text-xs font-bold uppercase text-sky-700 dark:text-sky-400">
                                            Ship{" "}
                                        </Text>
                                    )}
                                    {isUpcharge && (
                                        <Text className="text-xs font-bold uppercase text-orange-700 dark:text-orange-400">
                                            Upcharge{" "}
                                        </Text>
                                    )}
                                    {line.description}
                                </Text>
                                <View className="mt-0.5 flex-row flex-wrap items-center gap-x-2 gap-y-1">
                                    {line.brand ? (
                                        <Text className="text-xs text-zinc-500 dark:text-zinc-400">{line.brand}</Text>
                                    ) : null}
                                    {line.size ? (
                                        <Text className="text-xs text-zinc-500 dark:text-zinc-400">{line.size}</Text>
                                    ) : null}
                                    {choices ? (
                                        <Text className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                                            {choices}
                                        </Text>
                                    ) : null}
                                    {!isService && (
                                        <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                                            Qty {line.quantity}
                                        </Text>
                                    )}
                                    {isIncluded ? (
                                        <Badge
                                            text="Included"
                                            className="bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300"
                                        />
                                    ) : (
                                        <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                                            {FormatCurrency(line.unitPrice)} ea
                                        </Text>
                                    )}
                                    {HasDiscount(sale) && (
                                        <Badge
                                            text={`Sale -${DiscountText(sale)}`}
                                            className="bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300"
                                        />
                                    )}
                                    {HasDiscount(discount) && (
                                        <Badge
                                            text={`-${DiscountText(discount)}${
                                                (line.discountAmount ?? 0) > 0 && !(line.discountPercent ?? 0)
                                                    ? " ea"
                                                    : ""
                                            }`}
                                            className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                                        />
                                    )}
                                    {!PrintsOnSalesSheet(line) && (
                                        <Badge
                                            text="Not on sales sheet"
                                            className="bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                                        />
                                    )}
                                    {line.takeWith && (
                                        <Badge
                                            text="Take with"
                                            className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                                        />
                                    )}
                                    {line.includesAdjustableBase && !hasBaseRow.has(line.id) && (
                                        <Badge
                                            text="Incl. base"
                                            className="bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300"
                                        />
                                    )}
                                </View>
                                {line.notes ? (
                                    <View className="mt-1 flex-row gap-1.5 rounded-lg bg-amber-50 px-2 py-1 dark:bg-amber-950/40">
                                        <Icon
                                            icon="fa-solid fa-note-sticky"
                                            className="mt-0.5 text-xs text-amber-900 dark:text-amber-200"
                                        />
                                        <Text className="flex-1 text-sm text-amber-900 dark:text-amber-200">
                                            {line.notes}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>

                            <Text className="text-lg font-bold tabular-nums">
                                {isIncluded ? "Incl." : FormatCurrency(line.lineTotal)}
                            </Text>
                        </View>

                        {!readOnly && !isIncluded && (
                            <View className="mt-2 flex-row flex-wrap items-center gap-2">
                                {onQuantity && !isChild && (
                                    <View className="flex-row items-center rounded-xl bg-zinc-100 dark:bg-zinc-700">
                                        <IconButton
                                            icon="fa-solid fa-minus"
                                            label="One fewer"
                                            disabled={(line.quantity ?? 1) <= 1}
                                            onPress={() => onQuantity(line, (line.quantity ?? 1) - 1)}
                                        />
                                        <Text className="min-w-[24px] text-center text-sm font-bold tabular-nums">
                                            {line.quantity ?? 1}
                                        </Text>
                                        <IconButton
                                            icon="fa-solid fa-plus"
                                            label="One more"
                                            onPress={() => onQuantity(line, (line.quantity ?? 1) + 1)}
                                        />
                                    </View>
                                )}
                                {onEdit && (
                                    <Button
                                        text="Edit"
                                        icon="fa-solid fa-pen"
                                        onClick={() => onEdit(line)}
                                        className="min-h-[40px] bg-zinc-500 px-3 text-sm dark:bg-zinc-600"
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
                                {onAddUpcharge && !isChild && (
                                    <Button
                                        text="Add upcharge"
                                        icon="fa-solid fa-circle-plus"
                                        onClick={() => onAddUpcharge(line)}
                                        className="min-h-[40px] bg-orange-700 px-3 text-sm dark:bg-orange-600"
                                    />
                                )}
                                {onRemove && (
                                    <Button
                                        text="Remove"
                                        icon="fa-solid fa-trash"
                                        onClick={() => onRemove(line)}
                                        className="min-h-[40px] bg-red-700 px-3 text-sm dark:bg-red-600"
                                    />
                                )}
                                {onReorder && !isChild && itemIds.length > 1 && (
                                    <View className="ml-auto flex-row items-center">
                                        <IconButton
                                            icon="fa-solid fa-arrow-up"
                                            label="Move up"
                                            disabled={position === 0}
                                            onPress={() => move(line, -1)}
                                        />
                                        <IconButton
                                            icon="fa-solid fa-arrow-down"
                                            label="Move down"
                                            disabled={position === itemIds.length - 1}
                                            onPress={() => move(line, 1)}
                                        />
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                );
            })}
        </View>
    );
};

export default OrderLineList;
