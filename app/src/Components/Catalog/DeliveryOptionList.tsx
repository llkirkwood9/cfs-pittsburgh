import { View } from "react-native";
import SaleEditor from "./SaleEditor";
import Button from "../Elements/Button";
import Checkbox from "../Elements/Checkbox";
import ConfirmationModal from "../Elements/ConfirmationModal";
import Grid, { Cell } from "../Elements/Grid";
import Icon from "../Elements/Icon";
import Modal from "../Elements/Modal";
import SortableList from "../Elements/SortableList";
import SwipeRow from "../Elements/SwipeRow";
import Text from "../Elements/Text";
import TextField from "../Elements/TextField";
import { useCatalogOptionList } from "@shared/Hooks/useCatalogOptionList";
import { DeliveryOptionForm } from "@shared/Lib/CatalogOptions";
import { FormatCurrency } from "@shared/Lib/Format";
import { CleanDiscount, DiscountText, HasDiscount } from "@shared/Lib/Pricing";
import type { DeliveryOption } from "@shared/Models/DeliveryOption";
import { Limits } from "@shared/Lib/Limits";

type Props = {
    options: DeliveryOption[];
    onSave: (option: DeliveryOption) => Promise<void>;
    onDelete: (id: number) => Promise<void>;
    /** Every option id in the new order. */
    onReorder: (ids: number[]) => Promise<void>;
    /** Deleting removes the option for good rather than archiving a used one. */
    permanentDelete?: boolean;
};

const meta = "text-xs text-zinc-500 dark:text-zinc-400";

/**
 * The shared catalog of delivery methods and in-home services. Products pick from this list, so
 * adding White Glove here makes it available to attach anywhere. Holding one and dragging it
 * sets the order the sales floor offers them in.
 */
const DeliveryOptionList = ({
    options,
    onSave,
    onDelete,
    onReorder,
    permanentDelete = false,
}: Props) => {
    const list = useCatalogOptionList(options, DeliveryOptionForm, onSave, onDelete, onReorder);
    const { draft, change, editing, deleting } = list;

    return (
        <View>
            <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-base font-bold">Delivery & services</Text>
                <Button
                    text="Add"
                    icon="fa-solid fa-plus"
                    onClick={list.add}
                    className="bg-green-700 dark:bg-green-600"
                />
            </View>

            <SortableList
                data={options}
                keyExtractor={(option) => String(option.id)}
                onReorder={(reordered) => onReorder(reordered.map((o) => o.id ?? 0))}
                renderItem={(option, index) => {
                    const off = CleanDiscount(
                        option.saleDiscountPercent,
                        option.saleDiscountAmount
                    );
                    return (
                        <SwipeRow
                            onPress={() => list.open(option)}
                            actions={[
                                {
                                    label: "Delete",
                                    icon: "fa-solid fa-trash",
                                    tone: "danger",
                                    onPress: () => list.setDeleting(option),
                                },
                            ]}
                            accessibilityOnlyActions={[
                                ...(index > 0
                                    ? [{ label: "Move up", onPress: () => list.move(index, -1) }]
                                    : []),
                                ...(index < options.length - 1
                                    ? [{ label: "Move down", onPress: () => list.move(index, 1) }]
                                    : []),
                            ]}
                            accessibilityLabel={`${option.name}, ${FormatCurrency(option.price)}`}
                            className="flex-row items-center gap-3 p-3"
                        >
                            <View className="min-w-0 flex-1">
                                <Text className="font-semibold">{option.name}</Text>
                                <View className="flex-row flex-wrap items-center gap-x-2">
                                    <Text className={meta}>{FormatCurrency(option.price)}</Text>
                                    {HasDiscount(off) && (
                                        <View className="rounded bg-rose-100 px-1.5 dark:bg-rose-900/50">
                                            <Text className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                                                Sale {DiscountText(off)} off
                                            </Text>
                                        </View>
                                    )}
                                    <Text className={meta}>
                                        {option.isTaxable ? "Taxable" : "Not taxable"}
                                    </Text>
                                    {option.isTakeWith && (
                                        <Text className={meta}>Ticks Take With</Text>
                                    )}
                                    {option.showOnSalesSheet === false && (
                                        <Text className={meta}>Not on sales sheet</Text>
                                    )}
                                    {!option.isActive && (
                                        <Text className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                                            Archived
                                        </Text>
                                    )}
                                </View>
                            </View>
                            <Icon
                                icon="fa-solid fa-chevron-right"
                                className="text-xs text-zinc-400"
                            />
                        </SwipeRow>
                    );
                }}
            />

            {editing && (
                <Modal
                    title={editing.id ? "Edit delivery option" : "New delivery option"}
                    onClose={list.close}
                    footer={
                        <>
                            <Button
                                text="Cancel"
                                onClick={list.close}
                                className="bg-zinc-500 dark:bg-zinc-600"
                            />
                            <Button
                                text="Save"
                                icon="fa-solid fa-check"
                                onClick={list.save}
                                loading={list.saving}
                            />
                        </>
                    }
                >
                    <Grid columns={{ base: 1, sm: 2 }}>
                        <TextField
                            label="Name"
                            value={draft.name}
                            onChange={(value) => change({ name: value })}
                            maxLength={Limits.optionListName}
                        />
                        <TextField
                            label="Price"
                            value={draft.price}
                            onChange={(value) => change({ price: value })}
                            inputMode="decimal"
                        />
                        <Checkbox
                            label="Taxable"
                            checked={draft.isTaxable}
                            onChange={(value) => change({ isTaxable: value })}
                        />
                        <Checkbox
                            label="Ticks the Take With box"
                            checked={draft.isTakeWith}
                            onChange={(value) => change({ isTakeWith: value })}
                        />
                        <Cell span={{ base: 1, sm: 2 }}>
                            <Checkbox
                                label="Show on sales sheet"
                                checked={draft.showOnSalesSheet}
                                onChange={(value) => change({ showOnSalesSheet: value })}
                            />
                        </Cell>
                        <Cell span={{ base: 1, sm: 2 }}>
                            <Checkbox
                                label="Offered on the floor"
                                checked={draft.isActive}
                                onChange={(value) => change({ isActive: value })}
                            />
                        </Cell>
                        <Cell span={{ base: 1, sm: 2 }}>
                            <SaleEditor
                                draft={draft.sale}
                                onChange={(value) => change({ sale: value })}
                                label="Sale on this option"
                            />
                        </Cell>
                    </Grid>
                </Modal>
            )}

            {deleting && (
                <ConfirmationModal
                    title="Delete delivery option"
                    message={
                        permanentDelete
                            ? `Permanently delete "${deleting.name}"? Past sales sheets keep the shipping row as printed, but products stop offering it. This cannot be undone.`
                            : `Delete "${deleting.name}"? If it already appears on an order it will be archived instead.`
                    }
                    confirmWord={permanentDelete ? "DELETE" : undefined}
                    confirmText="Delete"
                    destructive
                    onConfirm={list.confirmDelete}
                    onCancel={() => list.setDeleting(null)}
                />
            )}
        </View>
    );
};

export default DeliveryOptionList;
