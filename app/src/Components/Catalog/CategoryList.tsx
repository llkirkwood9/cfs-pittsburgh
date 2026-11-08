import { View } from "react-native";
import Button from "../Elements/Button";
import ConfirmationModal from "../Elements/ConfirmationModal";
import Icon from "../Elements/Icon";
import Modal from "../Elements/Modal";
import SelectField from "../Elements/SelectField";
import SortableList from "../Elements/SortableList";
import SwipeRow from "../Elements/SwipeRow";
import Text from "../Elements/Text";
import TextField from "../Elements/TextField";
import { useCatalogOptionList } from "@shared/Hooks/useCatalogOptionList";
import { StatColumnNames } from "@shared/Lib/Catalog";
import { CategoryForm, CategorySummary } from "@shared/Lib/CatalogOptions";
import { Limits } from "@shared/Lib/Limits";
import type { Category } from "@shared/Models/Category";
import type { StatColumn } from "@shared/Models/Product";

type Props = {
    categories: Category[];
    onSave: (category: Category) => Promise<void>;
    onDelete: (id: number) => Promise<void>;
    /** Every category id in the new order. */
    onReorder: (ids: number[]) => Promise<void>;
};

/**
 * The categories the territory's products are listed under, in the order of the tabs. Each one
 * says which stat-sheet column its items count in. Only an empty category can be deleted, so no
 * item is ever left without one.
 */
const CategoryList = ({ categories, onSave, onDelete, onReorder }: Props) => {
    const list = useCatalogOptionList(categories, CategoryForm, onSave, onDelete, onReorder);
    const { draft, change, editing, deleting } = list;
    const severalTerritories = new Set(categories.map((c) => c.territoryId)).size > 1;

    return (
        <View>
            <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-base font-bold">Categories</Text>
                <Button
                    text="Add"
                    icon="fa-solid fa-plus"
                    onClick={list.add}
                    className="bg-green-700 dark:bg-green-600"
                />
            </View>

            <Text className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
                Products are listed under these tabs, in this order. Each category counts on the
                stat sheet as one of its columns. Move a category&apos;s items to another one before
                deleting it.
            </Text>

            {categories.length === 0 && (
                <View className="rounded-xl bg-white p-4 raised-sm dark:bg-zinc-800">
                    <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                        No categories yet. Tap Add to create the first one.
                    </Text>
                </View>
            )}

            <SortableList
                data={categories}
                keyExtractor={(category) => String(category.id)}
                onReorder={(reordered) => onReorder(reordered.map((c) => c.id ?? 0))}
                renderItem={(category, index) => (
                    <SwipeRow
                        onPress={() => list.open(category)}
                        actions={
                            (category.productCount ?? 0) > 0
                                ? []
                                : [
                                      {
                                          label: "Delete",
                                          icon: "fa-solid fa-trash",
                                          tone: "danger",
                                          onPress: () => list.setDeleting(category),
                                      },
                                  ]
                        }
                        accessibilityOnlyActions={[
                            ...(index > 0
                                ? [{ label: "Move up", onPress: () => list.move(index, -1) }]
                                : []),
                            ...(index < categories.length - 1
                                ? [{ label: "Move down", onPress: () => list.move(index, 1) }]
                                : []),
                        ]}
                        accessibilityLabel={category.name ?? ""}
                        className="flex-row items-center gap-3 p-3"
                    >
                        <View className="min-w-0 flex-1">
                            <Text className="font-semibold">{category.name}</Text>
                            <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                                {CategorySummary(
                                    category,
                                    StatColumnNames[category.statColumn ?? "Misc"]
                                )}
                                {severalTerritories && category.territoryName
                                    ? ` - ${category.territoryName}`
                                    : ""}
                            </Text>
                        </View>
                        <Icon icon="fa-solid fa-chevron-right" className="text-xs text-zinc-400" />
                    </SwipeRow>
                )}
            />

            {editing && (
                <Modal
                    title={editing.id ? "Edit category" : "New category"}
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
                            maxLength={Limits.categoryName}
                            placeholder="ex. Hybrid Mattresses"
                            autoCapitalize="words"
                        />
                        <SelectField<StatColumn>
                            label="Counts on the stat sheet as"
                            value={draft.statColumn}
                            options={(Object.keys(StatColumnNames) as StatColumn[]).map((c) => ({
                                value: c,
                                label: StatColumnNames[c],
                            }))}
                            onChange={(value) => change({ statColumn: value })}
                        />
                        <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                            New items in Mattresses or Adjustable Bases have a warranty unless you
                            untick it. Items already sold keep the column they were sold under.
                        </Text>
                    </View>
                </Modal>
            )}

            {deleting && (
                <ConfirmationModal
                    title="Delete category"
                    message={`Delete "${deleting.name}"? It has no items.`}
                    confirmText="Delete"
                    destructive
                    onConfirm={list.confirmDelete}
                    onCancel={() => list.setDeleting(null)}
                />
            )}
        </View>
    );
};

export default CategoryList;
