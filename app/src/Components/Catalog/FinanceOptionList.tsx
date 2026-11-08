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
import { useCatalogOptionList } from "@shared/Hooks/useCatalogOptionList";
import { FinanceOptionForm } from "@shared/Lib/CatalogOptions";
import type { FinanceOption } from "@shared/Models/FinanceOption";
import { Limits } from "@shared/Lib/Limits";

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
    const list = useCatalogOptionList(options, FinanceOptionForm, onSave, onDelete, onReorder);
    const { draft, change, editing, deleting } = list;

    return (
        <View>
            <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-base font-bold">Financing options</Text>
                <Button
                    text="Add"
                    icon="fa-solid fa-plus"
                    onClick={list.add}
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

            <SortableList
                data={options}
                keyExtractor={(option) => String(option.id)}
                onReorder={(reordered) => onReorder(reordered.map((o) => o.id ?? 0))}
                renderItem={(option, index) => (
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
                    <View className="gap-3">
                        <TextField
                            label="Name"
                            value={draft.name}
                            onChange={(value) => change({ name: value })}
                            maxLength={Limits.optionListName}
                            placeholder="ex. 12 months SAC"
                        />
                        <Checkbox
                            label="Offered at checkout"
                            checked={draft.isActive}
                            onChange={(value) => change({ isActive: value })}
                        />
                    </View>
                </Modal>
            )}

            {deleting && (
                <ConfirmationModal
                    title="Delete financing option"
                    message={`Delete "${deleting.name}"? Sales already recorded with it keep its name.`}
                    confirmText="Delete"
                    destructive
                    onConfirm={list.confirmDelete}
                    onCancel={() => list.setDeleting(null)}
                />
            )}
        </View>
    );
};

export default FinanceOptionList;
