import { Pressable, View } from "react-native";
import Icon from "../Elements/Icon";
import SortableList from "../Elements/SortableList";
import SwipeRow from "../Elements/SwipeRow";
import type { SwipeAction } from "../Elements/SwipeRow";
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

/** A small round icon button, for the quantity stepper. */
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
 * Tap a line to edit it, swipe it to the left to add a service or an upcharge or to remove it,
 * and hold an item to drag it - with its own rows - to a new place.
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

    // The items in sales sheet order, each followed by its own rows, which move with it.
    const isItem = (l: OrderLine) => !l.parentLineId || !lines.some((p) => p.id === l.parentLineId);
    const groups: OrderLine[][] = [];
    for (const line of ordered) {
        if (isItem(line) || groups.length === 0) groups.push([line]);
        else groups[groups.length - 1].push(line);
    }

    // For screen readers, which can't drag: moves an item, with its own rows, up or down one place.
    const groupIndex = (line: OrderLine) => groups.findIndex((g) => g[0].id === line.id);
    const move = (index: number, by: number) => {
        const ids = groups.map((g) => g[0].id ?? 0);
        const [id] = ids.splice(index, 1);
        ids.splice(index + by, 0, id);
        onReorder?.(ids);
    };
    const moveActions = (line: OrderLine) => {
        const index = groupIndex(line);
        if (!onReorder || readOnly || index < 0) return [];
        return [
            ...(index > 0 ? [{ label: "Move up", onPress: () => move(index, -1) }] : []),
            ...(index < groups.length - 1 ? [{ label: "Move down", onPress: () => move(index, 1) }] : []),
        ];
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

    const renderLine = (line: OrderLine) => {
        const isService = line.lineType === "Delivery";
        const isIncluded = line.lineType === "Included";
        const isUpcharge = line.lineType === "Upcharge";
        const isChild = isService || isIncluded || isUpcharge;
        const sale = CleanDiscount(line.saleDiscountPercent, line.saleDiscountAmount);
        const discount = CleanDiscount(line.discountPercent, line.discountAmount);
        const choices = ChoicesText(line.choices);
        // An included item is part of its set: it isn't opened or changed on its own.
        const editable = !readOnly && !isIncluded;

        const actions: SwipeAction[] = [];
        if (editable && onAddService && !isChild)
            actions.push({
                label: "Add service",
                icon: "fa-solid fa-truck",
                tone: "sky",
                onPress: () => onAddService(line),
            });
        if (editable && onAddUpcharge && !isChild)
            actions.push({
                label: "Add upcharge",
                icon: "fa-solid fa-circle-plus",
                tone: "orange",
                onPress: () => onAddUpcharge(line),
            });
        if (editable && onRemove)
            actions.push({
                label: "Remove",
                icon: "fa-solid fa-trash",
                tone: "danger",
                onPress: () => onRemove(line),
            });

        return (
            <SwipeRow
                key={line.id}
                onPress={editable && onEdit ? () => onEdit(line) : undefined}
                actions={actions}
                accessibilityOnlyActions={moveActions(line)}
                accessibilityLabel={`${line.description}, ${
                    isIncluded ? "included" : FormatCurrency(line.lineTotal)
                }`}
                containerClassName={isChild ? "ml-4" : ""}
                className={cx(
                    "p-3",
                    isService && "border-l-4 border-sky-500/50",
                    isIncluded && "border-l-4 border-violet-500/50",
                    isUpcharge && "border-l-4 border-orange-500/50"
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

                {/* The quantity stays on the card, a tap away, as it is changed so often. */}
                {editable && onQuantity && !isChild && (
                    <View className="mt-2 flex-row">
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
                    </View>
                )}
            </SwipeRow>
        );
    };

    const renderGroup = (group: OrderLine[]) => <View className="gap-2">{group.map(renderLine)}</View>;

    if (onReorder && !readOnly) {
        return (
            <View className="gap-2">
                <SortableList
                    data={groups}
                    keyExtractor={(group) => String(group[0].id)}
                    renderItem={renderGroup}
                    onReorder={(reordered) => onReorder(reordered.map((group) => group[0].id ?? 0))}
                />
            </View>
        );
    }

    return (
        <View className="gap-2">
            {groups.map((group) => (
                <View key={group[0].id}>{renderGroup(group)}</View>
            ))}
        </View>
    );
};

export default OrderLineList;
