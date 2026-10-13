import { useState } from "react";
import { View } from "react-native";
import SaleEditor, { FromSaleDraft, SaleProblem, ToSaleDraft } from "./SaleEditor";
import type { SaleDraft } from "./SaleEditor";
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
import { FormatCurrency, ParseMoney } from "../../Lib/ModelHelpers";
import { CleanDiscount, DiscountText, HasDiscount } from "../../Lib/Pricing";
import { Toast } from "../../Lib/Toast";
import type { DeliveryOption } from "../../Models/DeliveryOption";

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
    const [editing, setEditing] = useState<DeliveryOption | null>(null);
    const [deleting, setDeleting] = useState<DeliveryOption | null>(null);
    const [saving, setSaving] = useState<boolean>(false);

    const [name, setName] = useState<string>("");
    const [price, setPrice] = useState<string>("");
    const [isTaxable, setIsTaxable] = useState<boolean>(true);
    const [isTakeWith, setIsTakeWith] = useState<boolean>(false);
    const [showOnSalesSheet, setShowOnSalesSheet] = useState<boolean>(true);
    const [isActive, setIsActive] = useState<boolean>(true);
    const [sale, setSale] = useState<SaleDraft>({ mode: "none", text: "" });

    const open = (option: DeliveryOption) => {
        setEditing(option);
        setName(option.name ?? "");
        setPrice(option.price === undefined ? "" : String(option.price));
        setIsTaxable(option.isTaxable ?? true);
        setIsTakeWith(option.isTakeWith ?? false);
        setShowOnSalesSheet(option.showOnSalesSheet ?? true);
        setIsActive(option.isActive ?? true);
        setSale(ToSaleDraft(option.saleDiscountPercent, option.saleDiscountAmount));
    };

    const handleSave = async () => {
        if (!name.trim()) return Toast.Warning("Give the option a name.");

        const parsed = ParseMoney(price) ?? 0;
        if (parsed < 0) return Toast.Warning("The price cannot be negative.");

        const saleProblem = SaleProblem(sale);
        if (saleProblem) return Toast.Warning(saleProblem);
        const saleOff = FromSaleDraft(sale);

        setSaving(true);
        await onSave({
            id: editing?.id,
            name: name.trim(),
            price: parsed,
            isTaxable,
            isTakeWith,
            showOnSalesSheet,
            isActive,
            // A new option goes to the end of the list.
            sortOrder: editing?.sortOrder,
            saleDiscountPercent: saleOff.percent,
            saleDiscountAmount: saleOff.amount,
        });
        setSaving(false);
        setEditing(null);
    };

    const move = (index: number, by: number) => {
        const ids = options.map((o) => o.id ?? 0);
        const [id] = ids.splice(index, 1);
        ids.splice(index + by, 0, id);
        onReorder(ids);
    };

    return (
        <View>
            <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-base font-bold">Delivery & services</Text>
                <Button
                    text="Add"
                    icon="fa-solid fa-plus"
                    onClick={() =>
                        open({ price: 0, isTaxable: true, isActive: true, showOnSalesSheet: true })
                    }
                    className="bg-green-700 dark:bg-green-600"
                />
            </View>

            <Text className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
                Tap an option to edit it, or swipe it to the left to delete it. Hold one and drag it
                to change the order the sales floor sees them in.
            </Text>

            <SortableList
                data={options}
                keyExtractor={(option) => String(option.id)}
                onReorder={(reordered) => onReorder(reordered.map((o) => o.id ?? 0))}
                renderItem={(option, index) => {
                    const off = CleanDiscount(option.saleDiscountPercent, option.saleDiscountAmount);
                    return (
                        <SwipeRow
                            onPress={() => open(option)}
                            actions={[
                                {
                                    label: "Delete",
                                    icon: "fa-solid fa-trash",
                                    tone: "danger",
                                    onPress: () => setDeleting(option),
                                },
                            ]}
                            accessibilityOnlyActions={[
                                ...(index > 0 ? [{ label: "Move up", onPress: () => move(index, -1) }] : []),
                                ...(index < options.length - 1
                                    ? [{ label: "Move down", onPress: () => move(index, 1) }]
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
                                    {option.isTakeWith && <Text className={meta}>Ticks Take With</Text>}
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
                            <Icon icon="fa-solid fa-chevron-right" className="text-xs text-zinc-400" />
                        </SwipeRow>
                    );
                }}
            />

            {editing && (
                <Modal
                    title={editing.id ? "Edit delivery option" : "New delivery option"}
                    onClose={() => setEditing(null)}
                    footer={
                        <>
                            <Button
                                text="Cancel"
                                onClick={() => setEditing(null)}
                                className="bg-zinc-500 dark:bg-zinc-600"
                            />
                            <Button
                                text="Save"
                                icon="fa-solid fa-check"
                                onClick={handleSave}
                                loading={saving}
                            />
                        </>
                    }
                >
                    <Grid columns={{ base: 1, sm: 2 }}>
                        <TextField label="Name" value={name} onChange={setName} maxLength={100} />
                        <TextField label="Price" value={price} onChange={setPrice} inputMode="decimal" />
                        <Checkbox label="Taxable" checked={isTaxable} onChange={setIsTaxable} />
                        <Checkbox
                            label="Ticks the Take With box"
                            checked={isTakeWith}
                            onChange={setIsTakeWith}
                        />
                        <Cell span={{ base: 1, sm: 2 }}>
                            <Checkbox
                                label="Show on sales sheet"
                                hint="When off, the row stays on the order but is left off the printed sheet. A row with a charge always prints."
                                checked={showOnSalesSheet}
                                onChange={setShowOnSalesSheet}
                            />
                        </Cell>
                        <Cell span={{ base: 1, sm: 2 }}>
                            <Checkbox
                                label="Offered on the floor"
                                checked={isActive}
                                onChange={setIsActive}
                            />
                        </Cell>
                        <Cell span={{ base: 1, sm: 2 }}>
                            <SaleEditor draft={sale} onChange={setSale} label="Sale on this option" />
                            <Text className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                Taken off whenever this option is added to an order, until it is
                                turned off. A product can set its own sale on it instead.
                            </Text>
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
                    onConfirm={async () => {
                        if (deleting.id) await onDelete(deleting.id);
                        setDeleting(null);
                    }}
                    onCancel={() => setDeleting(null)}
                />
            )}
        </View>
    );
};

export default DeliveryOptionList;
