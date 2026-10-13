import { useState } from "react";
import { View } from "react-native";
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

type Props = {
    options: FinanceOption[];
    onSave: (option: FinanceOption) => Promise<void>;
    onDelete: (id: number) => Promise<void>;
    /** Every option id in the new order. */
    onReorder: (ids: number[]) => Promise<void>;
};

/**
 * The kinds of financing a customer can choose at checkout, such as "12 months no interest", in
 * the order checkout lists them. Whether checkout may also pick Other and type one in is set
 * under Settings.
 */
const FinanceOptionList = ({ options, onSave, onDelete, onReorder }: Props) => {
    const [editing, setEditing] = useState<FinanceOption | null>(null);
    const [deleting, setDeleting] = useState<FinanceOption | null>(null);
    const [saving, setSaving] = useState<boolean>(false);

    const [name, setName] = useState<string>("");
    const [isActive, setIsActive] = useState<boolean>(true);

    const open = (option: FinanceOption) => {
        setEditing(option);
        setName(option.name ?? "");
        setIsActive(option.isActive ?? true);
    };

    const handleSave = async () => {
        if (!name.trim()) return Toast.Warning("Give the option a name.");

        setSaving(true);
        await onSave({ id: editing?.id, name: name.trim(), isActive });
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
                <Text className="text-base font-bold">Financing options</Text>
                <Button
                    text="Add"
                    icon="fa-solid fa-plus"
                    onClick={() => open({ isActive: true })}
                    className="bg-green-700 dark:bg-green-600"
                />
            </View>

            <Text className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
                The kinds of financing a customer can choose. Checkout picks one, and enters the
                financing number, when a sale is financed; both print in the sales sheet&apos;s
                comments. Whether checkout can also pick{" "}
                <Text className="text-sm font-bold">Other</Text> and type one in is set under
                Settings. Tap an option to edit it, swipe it to the left to delete it, or hold it and
                drag it to change the order.
            </Text>

            {options.length === 0 && (
                <View className="rounded-xl bg-white p-4 raised-sm dark:bg-zinc-800">
                    <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                        No financing options yet. Tap Add to create the first one.
                    </Text>
                </View>
            )}

            <SortableList
                data={options}
                keyExtractor={(option) => String(option.id)}
                onReorder={(reordered) => onReorder(reordered.map((o) => o.id ?? 0))}
                renderItem={(option, index) => (
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
                        accessibilityLabel={option.name ?? ""}
                        className="flex-row items-center gap-3 p-3"
                    >
                        <View className="min-w-0 flex-1">
                            <Text className="font-semibold">{option.name}</Text>
                            {!option.isActive && (
                                <Text className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                                    Not offered at checkout
                                </Text>
                            )}
                        </View>
                        <Icon icon="fa-solid fa-chevron-right" className="text-xs text-zinc-400" />
                    </SwipeRow>
                )}
            />

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
                        <TextField
                            label="Name"
                            value={name}
                            onChange={setName}
                            maxLength={100}
                            placeholder="e.g. 12 months no interest"
                        />
                        <Checkbox label="Offered at checkout" checked={isActive} onChange={setIsActive} />
                        <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                            Renaming an option doesn&apos;t change sales already recorded with it.
                        </Text>
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
