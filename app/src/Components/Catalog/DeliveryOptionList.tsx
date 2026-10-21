import { useState } from "react";
import { View } from "react-native";
import SaleEditor, { FromSaleDraft, SaleProblem, ToSaleDraft } from "./SaleEditor";
import type { SaleDraft } from "./SaleEditor";
import { ScopeBadge, ScopeField } from "./CatalogScope";
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
import type { Territory } from "../../Models/Territory";

type Props = {
    options: DeliveryOption[];
    onSave: (option: DeliveryOption) => Promise<void>;
    onDelete: (id: number) => Promise<void>;
    /** The ids of one list (global, or one territory's own) in their new order. */
    onReorder: (ids: number[]) => Promise<void>;
    territories: Territory[];
    /** System Admins and administrators choose where an option is offered; managers' stay in their territory. */
    canChooseTerritory: boolean;
    /** The manager's own territory, shown when they can't choose. */
    ownTerritoryName?: string | null;
    /** Where a new option goes by default: the territory in view, or global. */
    defaultTerritoryId?: number | null;
    /** Deleting removes the option for good rather than archiving a used one. */
    permanentDelete?: boolean;
};

const meta = "text-xs text-zinc-500 dark:text-zinc-400";

/**
 * The catalog of delivery methods and in-home services. Products pick from this list, so adding
 * White Glove here makes it available to attach anywhere it's offered. Global options are offered
 * in every territory; a territory can add its own, which only its items can offer. Holding one and
 * dragging it sets the order the sales floor offers them in, within the global list and each
 * territory's own.
 */
const DeliveryOptionList = ({
    options,
    onSave,
    onDelete,
    onReorder,
    territories,
    canChooseTerritory,
    ownTerritoryName,
    defaultTerritoryId = null,
    permanentDelete = false,
}: Props) => {
    const [territoryId, setTerritoryId] = useState<number | null>(null);
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
        setTerritoryId(option.id ? (option.territoryId ?? null) : defaultTerritoryId);
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
            territoryId,
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

    // The global options first, then each territory's own: each list reorders among itself.
    const groups: DeliveryOption[][] = [];
    for (const option of options) {
        const group = groups.find((g) => (g[0].territoryId ?? null) === (option.territoryId ?? null));
        if (group) group.push(option);
        else groups.push([option]);
    }

    const move = (group: DeliveryOption[], index: number, by: number) => {
        const ids = group.map((o) => o.id ?? 0);
        const [id] = ids.splice(index, 1);
        ids.splice(index + by, 0, id);
        onReorder(ids);
    };

    const renderOption = (option: DeliveryOption, group: DeliveryOption[], index: number) => {
        const off = CleanDiscount(option.saleDiscountPercent, option.saleDiscountAmount);
        const editable = option.canEdit !== false;
        return (
            <SwipeRow
                onPress={editable ? () => open(option) : undefined}
                actions={
                    editable
                        ? [
                              {
                                  label: "Delete",
                                  icon: "fa-solid fa-trash",
                                  tone: "danger",
                                  onPress: () => setDeleting(option),
                              },
                          ]
                        : []
                }
                accessibilityOnlyActions={
                    editable
                        ? [
                              ...(index > 0
                                  ? [{ label: "Move up", onPress: () => move(group, index, -1) }]
                                  : []),
                              ...(index < group.length - 1
                                  ? [{ label: "Move down", onPress: () => move(group, index, 1) }]
                                  : []),
                          ]
                        : []
                }
                accessibilityLabel={`${option.name}, ${FormatCurrency(option.price)}`}
                className="flex-row items-center gap-3 p-3"
            >
                <View className="min-w-0 flex-1">
                    <View className="flex-row flex-wrap items-center gap-2">
                        <Text className="font-semibold">{option.name}</Text>
                        <ScopeBadge territoryName={option.territoryName} />
                    </View>
                    <View className="flex-row flex-wrap items-center gap-x-2">
                        <Text className={meta}>{FormatCurrency(option.price)}</Text>
                        {HasDiscount(off) && (
                            <View className="rounded bg-rose-100 px-1.5 dark:bg-rose-900/50">
                                <Text className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                                    Sale {DiscountText(off)} off
                                </Text>
                            </View>
                        )}
                        <Text className={meta}>{option.isTaxable ? "Taxable" : "Not taxable"}</Text>
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
                {editable ? (
                    <Icon icon="fa-solid fa-chevron-right" className="text-xs text-zinc-400" />
                ) : (
                    <View className="flex-row items-center gap-1.5">
                        <Icon icon="fa-solid fa-lock" className="text-xs text-zinc-500 dark:text-zinc-400" />
                        <Text className={meta}>Set company-wide</Text>
                    </View>
                )}
            </SwipeRow>
        );
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

            <View className="gap-4">
                {groups.map((group) => {
                    // Global options are set company-wide; a manager sees them but can't change them.
                    const locked = group.every((o) => o.canEdit === false);
                    return (
                        <View key={group[0].territoryId ?? "global"} className="gap-2">
                            {groups.length > 1 && (
                                <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                    {group[0].territoryName ?? "Global"}
                                </Text>
                            )}
                            <SortableList
                                data={group}
                                enabled={!locked}
                                keyExtractor={(option) => String(option.id)}
                                onReorder={(reordered) => onReorder(reordered.map((o) => o.id ?? 0))}
                                renderItem={(option, index) => renderOption(option, group, index)}
                            />
                        </View>
                    );
                })}
            </View>

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
                        <Cell span={{ base: 1, sm: 2 }}>
                            <ScopeField
                                value={territoryId}
                                onChange={setTerritoryId}
                                territories={territories}
                                canChoose={canChooseTerritory}
                                fixedName={ownTerritoryName}
                            />
                        </Cell>
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
