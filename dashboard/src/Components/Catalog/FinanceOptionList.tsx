import { useState } from "react";
import Button from "../Elements/Button";
import ConfirmationModal from "../Elements/ConfirmationModal";
import Icon from "../Elements/Icon";
import Modal from "../Elements/Modal";
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
        <>
            <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-bold">Financing options</h2>
                <Button
                    text="Add"
                    icon="fa-solid fa-plus"
                    onClick={() => open({ isActive: true })}
                    className="bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                />
            </div>

            <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
                The kinds of financing a customer can choose. Checkout picks one, and enters the
                financing number, when a sale is financed; both print in the sales sheet&apos;s
                comments. Whether checkout can also pick <strong>Other</strong> and type one in is
                set under Settings.
            </p>

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
                            onClick={() => move(index, -1)}
                            disabled={index === 0}
                            aria-label="Move up"
                            className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100
                                disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-700"
                        >
                            <Icon icon="fa-solid fa-arrow-up" />
                        </button>
                        <button
                            type="button"
                            onClick={() => move(index, 1)}
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
                            onClick={() => open(option)}
                            className="min-h-[40px] bg-zinc-500 px-3 text-sm hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                        />
                        <button
                            type="button"
                            onClick={() => setDeleting(option)}
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
                    onClose={() => setEditing(null)}
                    footer={
                        <>
                            <Button
                                text="Cancel"
                                onClick={() => setEditing(null)}
                                className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
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
                    <div className="space-y-3">
                        <TextField
                            label="Name"
                            value={name}
                            onChange={setName}
                            maxLength={100}
                            placeholder="ex. 12 months SAC"
                        />
                        <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl bg-zinc-100 px-3 dark:bg-zinc-700">
                            <input
                                type="checkbox"
                                checked={isActive}
                                onChange={(e) => setIsActive(e.target.checked)}
                                className="h-5 w-5 accent-sky-600"
                            />
                            <span className="text-sm font-medium">Offered at checkout</span>
                        </label>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Renaming an option doesn&apos;t change sales already recorded with it.
                        </p>
                    </div>
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
        </>
    );
};

export default FinanceOptionList;
