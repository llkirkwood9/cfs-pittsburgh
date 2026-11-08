import Button from "../Elements/Button";
import ConfirmationModal from "../Elements/ConfirmationModal";
import Icon from "../Elements/Icon";
import Modal from "../Elements/Modal";
import TextField from "../Elements/TextField";
import SaleEditor from "./SaleEditor";
import { useCatalogOptionList } from "@shared/Hooks/useCatalogOptionList";
import { DeliveryOptionForm } from "@shared/Lib/CatalogOptions";
import { FormatCurrency } from "@shared/Lib/Format";
import { CleanDiscount, DiscountText, HasDiscount } from "@shared/Lib/Pricing";
import type { DeliveryOption } from "@shared/Models/DeliveryOption";

type Props = {
    options: DeliveryOption[];
    onSave: (option: DeliveryOption) => Promise<void>;
    onDelete: (id: number) => Promise<void>;
    /** Every option id in the new order. */
    onReorder: (ids: number[]) => Promise<void>;
    /** System Admin: deleting removes the option for good rather than archiving a used one. */
    permanentDelete?: boolean;
};

/**
 * The shared catalog of delivery methods and in-home services. Products pick from this list, so
 * adding White Glove here makes it available to attach anywhere. The arrows set the order the
 * sales floor offers them in.
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
        <>
            <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-bold">Delivery &amp; services</h2>
                <Button
                    text="Add"
                    icon="fa-solid fa-plus"
                    onClick={list.add}
                    className="bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                />
            </div>

            <ul className="space-y-2">
                {options.map((option, index) => (
                    <li
                        key={option.id}
                        className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 shadow-xs dark:bg-zinc-800"
                    >
                        <div className="min-w-0 flex-1">
                            <p className="font-semibold">{option.name}</p>
                            <p className="flex flex-wrap gap-x-2 text-xs text-zinc-500 dark:text-zinc-400">
                                <span>{FormatCurrency(option.price)}</span>
                                {HasDiscount(
                                    CleanDiscount(
                                        option.saleDiscountPercent,
                                        option.saleDiscountAmount
                                    )
                                ) && (
                                    <span className="rounded-sm bg-rose-100 px-1.5 font-semibold text-rose-800 dark:bg-rose-900/50 dark:text-rose-300">
                                        Sale{" "}
                                        {DiscountText(
                                            CleanDiscount(
                                                option.saleDiscountPercent,
                                                option.saleDiscountAmount
                                            )
                                        )}{" "}
                                        off
                                    </span>
                                )}
                                <span>{option.isTaxable ? "Taxable" : "Not taxable"}</span>
                                {option.isTakeWith && <span>Ticks Take With</span>}
                                {option.showOnSalesSheet === false && (
                                    <span>Not on sales sheet</span>
                                )}
                                {!option.isActive && (
                                    <span className="font-semibold text-amber-700 dark:text-amber-400">
                                        Archived
                                    </span>
                                )}
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
                    title={editing.id ? "Edit delivery option" : "New delivery option"}
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
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <TextField
                            label="Name"
                            value={draft.name}
                            onChange={(value) => change({ name: value })}
                            maxLength={100}
                        />
                        <TextField
                            label="Price"
                            value={draft.price}
                            onChange={(value) => change({ price: value })}
                            inputMode="decimal"
                        />

                        <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl bg-zinc-100 px-3 dark:bg-zinc-700">
                            <input
                                type="checkbox"
                                checked={draft.isTaxable}
                                onChange={(e) => change({ isTaxable: e.target.checked })}
                                className="h-5 w-5 accent-sky-600"
                            />
                            <span className="text-sm font-medium">Taxable</span>
                        </label>

                        <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl bg-zinc-100 px-3 dark:bg-zinc-700">
                            <input
                                type="checkbox"
                                checked={draft.isTakeWith}
                                onChange={(e) => change({ isTakeWith: e.target.checked })}
                                className="h-5 w-5 accent-sky-600"
                            />
                            <span className="text-sm font-medium">Ticks the Take With box</span>
                        </label>

                        <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl bg-zinc-100 px-3 sm:col-span-2 dark:bg-zinc-700">
                            <input
                                type="checkbox"
                                checked={draft.showOnSalesSheet}
                                onChange={(e) => change({ showOnSalesSheet: e.target.checked })}
                                className="h-5 w-5 accent-sky-600"
                            />
                            <span className="text-sm">
                                <span className="font-medium">Show on sales sheet</span>
                            </span>
                        </label>

                        <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl bg-zinc-100 px-3 sm:col-span-2 dark:bg-zinc-700">
                            <input
                                type="checkbox"
                                checked={draft.isActive}
                                onChange={(e) => change({ isActive: e.target.checked })}
                                className="h-5 w-5 accent-sky-600"
                            />
                            <span className="text-sm font-medium">Offered on the floor</span>
                        </label>

                        <div className="sm:col-span-2">
                            <SaleEditor
                                draft={draft.sale}
                                onChange={(value) => change({ sale: value })}
                                label="Sale on this option"
                            />
                        </div>
                    </div>
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
        </>
    );
};

export default DeliveryOptionList;
