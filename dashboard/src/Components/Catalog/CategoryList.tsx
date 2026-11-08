import Button from "../Elements/Button";
import ConfirmationModal from "../Elements/ConfirmationModal";
import Icon from "../Elements/Icon";
import Modal from "../Elements/Modal";
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
        <>
            <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-bold">Categories</h2>
                <Button
                    text="Add"
                    icon="fa-solid fa-plus"
                    onClick={list.add}
                    className="bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                />
            </div>

            <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
                Products are listed under these tabs, in this order. Each category counts on the
                stat sheet as one of its columns. Move a category&apos;s items to another one before
                deleting it.
            </p>

            {categories.length === 0 && (
                <p className="rounded-xl bg-white p-4 text-sm text-zinc-500 shadow-xs dark:bg-zinc-800 dark:text-zinc-400">
                    No categories yet. Tap Add to create the first one.
                </p>
            )}

            <ul className="space-y-2">
                {categories.map((category, index) => (
                    <li
                        key={category.id}
                        className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 shadow-xs dark:bg-zinc-800"
                    >
                        <div className="min-w-0 flex-1">
                            <p className="font-semibold">{category.name}</p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                {CategorySummary(
                                    category,
                                    StatColumnNames[category.statColumn ?? "Misc"]
                                )}
                                {severalTerritories && category.territoryName
                                    ? ` - ${category.territoryName}`
                                    : ""}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => list.move(index, -1)}
                            disabled={index === 0}
                            aria-label="Move up"
                            className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100
                                disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-700"
                        >
                            <Icon icon="fa-solid fa-arrow-up" />
                        </button>
                        <button
                            type="button"
                            onClick={() => list.move(index, 1)}
                            disabled={index === categories.length - 1}
                            aria-label="Move down"
                            className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100
                                disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-700"
                        >
                            <Icon icon="fa-solid fa-arrow-down" />
                        </button>
                        <Button
                            text="Edit"
                            icon="fa-solid fa-pen"
                            onClick={() => list.open(category)}
                            className="min-h-[40px] bg-zinc-500 px-3 text-sm hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                        />
                        <button
                            type="button"
                            onClick={() => list.setDeleting(category)}
                            disabled={(category.productCount ?? 0) > 0}
                            aria-label="Delete category"
                            title={
                                (category.productCount ?? 0) > 0
                                    ? "Move its items to another category first"
                                    : undefined
                            }
                            className="flex h-10 w-10 items-center justify-center rounded-lg text-red-700
                                hover:bg-red-100 disabled:opacity-30 disabled:hover:bg-transparent
                                dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                            <Icon icon="fa-solid fa-trash" />
                        </button>
                    </li>
                ))}
            </ul>

            {editing && (
                <Modal
                    title={editing.id ? "Edit category" : "New category"}
                    onClose={list.close}
                    footer={
                        <>
                            <Button
                                text="Cancel"
                                onClick={list.close}
                                className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
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
                    <div className="space-y-3">
                        <TextField
                            label="Name"
                            value={draft.name}
                            onChange={(value) => change({ name: value })}
                            maxLength={Limits.categoryName}
                            placeholder="ex. Hybrid Mattresses"
                        />
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                Counts on the stat sheet as
                            </span>
                            <select
                                value={draft.statColumn}
                                onChange={(e) =>
                                    change({ statColumn: e.target.value as StatColumn })
                                }
                                className="min-h-[48px] rounded-xl border border-zinc-300 bg-white px-3 text-base
                                    text-zinc-900 outline-hidden focus:border-sky-600
                                    dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                            >
                                {(Object.keys(StatColumnNames) as StatColumn[]).map((c) => (
                                    <option key={c} value={c}>
                                        {StatColumnNames[c]}
                                    </option>
                                ))}
                            </select>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                New items in Mattresses or Adjustable Bases have a warranty unless
                                you untick it. Items already sold keep the column they were sold
                                under.
                            </span>
                        </label>
                    </div>
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
        </>
    );
};

export default CategoryList;
