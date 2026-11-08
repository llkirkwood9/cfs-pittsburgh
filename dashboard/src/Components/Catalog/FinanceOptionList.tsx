import Button from "../Elements/Button";
import ConfirmationModal from "../Elements/ConfirmationModal";
import Icon from "../Elements/Icon";
import Modal from "../Elements/Modal";
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
        <>
            <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-bold">Financing options</h2>
                <Button
                    text="Add"
                    icon="fa-solid fa-plus"
                    onClick={list.add}
                    className="bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                />
            </div>

            {options.length === 0 && (
                <p className="rounded-xl bg-white p-4 text-sm text-zinc-500 shadow-xs dark:bg-zinc-800 dark:text-zinc-400">
                    No financing options yet. Tap Add to create the first one.
                </p>
            )}

            <ul className="space-y-2">
                {options.map((option, index) => (
                    <li
                        key={option.id}
                        className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 shadow-xs dark:bg-zinc-800"
                    >
                        <div className="min-w-0 flex-1">
                            <p className="font-semibold">{option.name}</p>
                            {!option.isActive && (
                                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                                    Not offered at checkout
                                </p>
                            )}
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
                            disabled={index === options.length - 1}
                            aria-label="Move down"
                            className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100
                                disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-700"
                        >
                            <Icon icon="fa-solid fa-arrow-down" />
                        </button>
                        <Button
                            text="Edit"
                            icon="fa-solid fa-pen"
                            onClick={() => list.open(option)}
                            className="min-h-[40px] bg-zinc-500 px-3 text-sm hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                        />
                        <button
                            type="button"
                            onClick={() => list.setDeleting(option)}
                            aria-label="Delete option"
                            className="flex h-10 w-10 items-center justify-center rounded-lg text-red-700
                                hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                            <Icon icon="fa-solid fa-trash" />
                        </button>
                    </li>
                ))}
            </ul>

            {editing && (
                <Modal
                    title={editing.id ? "Edit financing option" : "New financing option"}
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
                            maxLength={Limits.optionListName}
                            placeholder="ex. 12 months SAC"
                        />
                        <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl bg-zinc-100 px-3 dark:bg-zinc-700">
                            <input
                                type="checkbox"
                                checked={draft.isActive}
                                onChange={(e) => change({ isActive: e.target.checked })}
                                className="h-5 w-5 accent-sky-600"
                            />
                            <span className="text-sm font-medium">Offered at checkout</span>
                        </label>
                    </div>
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
        </>
    );
};

export default FinanceOptionList;
