import { useState } from "react";
import { View } from "react-native";
import { ScopeBadge, ScopeField } from "./CatalogScope";
import Button from "../Elements/Button";
import Checkbox from "../Elements/Checkbox";
import ConfirmationModal from "../Elements/ConfirmationModal";
import Icon from "../Elements/Icon";
import Modal from "../Elements/Modal";
import SortableList from "../Elements/SortableList";
import SwipeRow from "../Elements/SwipeRow";
import Text from "../Elements/Text";
import TextField from "../Elements/TextField";
import { Toast } from "../../Lib/Toast";
import type { FinanceOption } from "../../Models/FinanceOption";
import type { Territory } from "../../Models/Territory";

type Props = {
    options: FinanceOption[];
    onSave: (option: FinanceOption) => Promise<void>;
    onDelete: (id: number) => Promise<void>;
    /** Every option id of one list (global, or one territory's own) in the new order. */
    onReorder: (ids: number[]) => Promise<void>;
    territories: Territory[];
    /** System Admins and administrators choose where an option is offered; managers' stay in their territory. */
    canChooseTerritory: boolean;
    /** The manager's own territory, shown when they can't choose. */
    ownTerritoryName?: string | null;
    /** Where a new option goes by default: the territory in view, or global. */
    defaultTerritoryId?: number | null;
};

/**
 * The kinds of financing a customer can choose at checkout, such as "12 months no interest", in
 * the order checkout lists them. Whether checkout may also pick Other and type one in is set
 * under Settings. Global options are offered in every territory, first; a territory can add its
 * own, which come after them. Each list keeps its own order.
 */
const FinanceOptionList = ({
    options,
    onSave,
    onDelete,
    onReorder,
    territories,
    canChooseTerritory,
    ownTerritoryName,
    defaultTerritoryId = null,
}: Props) => {
    const [editing, setEditing] = useState<FinanceOption | null>(null);
    const [deleting, setDeleting] = useState<FinanceOption | null>(null);
    const [saving, setSaving] = useState<boolean>(false);

    const [name, setName] = useState<string>("");
    const [isActive, setIsActive] = useState<boolean>(true);
    const [territoryId, setTerritoryId] = useState<number | null>(null);

    const open = (option: FinanceOption) => {
        setEditing(option);
        setName(option.name ?? "");
        setIsActive(option.isActive ?? true);
        setTerritoryId(option.id ? (option.territoryId ?? null) : defaultTerritoryId);
    };

    const handleSave = async () => {
        if (!name.trim()) return Toast.Warning("Give the option a name.");

        setSaving(true);
        await onSave({ id: editing?.id, territoryId, name: name.trim(), isActive });
        setSaving(false);
        setEditing(null);
    };

    // The global options first, then each territory's own: each list reorders among itself.
    const groups: FinanceOption[][] = [];
    for (const option of options) {
        const group = groups.find((g) => (g[0].territoryId ?? null) === (option.territoryId ?? null));
        if (group) group.push(option);
        else groups.push([option]);
    }

    const move = (group: FinanceOption[], index: number, by: number) => {
        const ids = group.map((o) => o.id ?? 0);
        const [id] = ids.splice(index, 1);
        ids.splice(index + by, 0, id);
        onReorder(ids);
    };

    const renderOption = (option: FinanceOption, group: FinanceOption[], index: number) => {
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
                accessibilityLabel={option.name ?? ""}
                className="flex-row items-center gap-3 p-3"
            >
                <View className="min-w-0 flex-1">
                    <View className="flex-row flex-wrap items-center gap-2">
                        <Text className="font-semibold">{option.name}</Text>
                        <ScopeBadge territoryName={option.territoryName} />
                    </View>
                    {!option.isActive && (
                        <Text className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                            Not offered at checkout
                        </Text>
                    )}
                </View>
                {editable ? (
                    <Icon icon="fa-solid fa-chevron-right" className="text-xs text-zinc-400" />
                ) : (
                    <View className="flex-row items-center gap-1.5">
                        <Icon icon="fa-solid fa-lock" className="text-xs text-zinc-500 dark:text-zinc-400" />
                        <Text className="text-xs text-zinc-500 dark:text-zinc-400">Set company-wide</Text>
                    </View>
                )}
            </SwipeRow>
        );
    };

    return (
        <View>
            <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-base font-bold">Financing options</Text>
                <Button
                    text="Add"
                    icon="fa-solid fa-plus"
                    onClick={() => open({ isActive: true })}
                    className="bg-green-700 dark:bg-green-600"
                />
            </View>

            {options.length === 0 && (
                <View className="rounded-xl bg-white p-4 raised-sm dark:bg-zinc-800">
                    <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                        No financing options yet. Tap Add to create the first one.
                    </Text>
                </View>
            )}

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
                    title={editing.id ? "Edit financing option" : "New financing option"}
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
                    <View className="gap-3">
                        <ScopeField
                            value={territoryId}
                            onChange={setTerritoryId}
                            territories={territories}
                            canChoose={canChooseTerritory}
                            fixedName={ownTerritoryName}
                        />
                        <TextField
                            label="Name"
                            value={name}
                            onChange={setName}
                            maxLength={100}
                            placeholder="ex. 12 months SAC"
                        />
                        <Checkbox label="Offered at checkout" checked={isActive} onChange={setIsActive} />
                    </View>
                </Modal>
            )}

            {deleting && (
                <ConfirmationModal
                    title="Delete financing option"
                    message={`Delete "${deleting.name}"? Sales already recorded with it keep its name.`}
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

export default FinanceOptionList;
