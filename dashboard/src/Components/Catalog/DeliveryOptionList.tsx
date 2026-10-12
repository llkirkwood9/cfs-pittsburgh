import { useState } from "react";
import Button from "../Elements/Button";
import ConfirmationModal from "../Elements/ConfirmationModal";
import Icon from "../Elements/Icon";
import Modal from "../Elements/Modal";
import TextField from "../Elements/TextField";
import SaleEditor, { FromSaleDraft, SaleProblem, ToSaleDraft, type SaleDraft } from "./SaleEditor";
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
        <>
            <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-bold">Delivery &amp; services</h2>
                <Button
                    text="Add"
                    icon="fa-solid fa-plus"
                    onClick={() =>
                        open({ price: 0, isTaxable: true, isActive: true, showOnSalesSheet: true })
                    }
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
                    title={editing.id ? "Edit delivery option" : "New delivery option"}
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
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <TextField label="Name" value={name} onChange={setName} maxLength={100} />
                        <TextField
                            label="Price"
                            value={price}
                            onChange={setPrice}
                            inputMode="decimal"
                        />

                        <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl bg-zinc-100 px-3 dark:bg-zinc-700">
                            <input
                                type="checkbox"
                                checked={isTaxable}
                                onChange={(e) => setIsTaxable(e.target.checked)}
                                className="h-5 w-5 accent-sky-600"
                            />
                            <span className="text-sm font-medium">Taxable</span>
                        </label>

                        <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl bg-zinc-100 px-3 dark:bg-zinc-700">
                            <input
                                type="checkbox"
                                checked={isTakeWith}
                                onChange={(e) => setIsTakeWith(e.target.checked)}
                                className="h-5 w-5 accent-sky-600"
                            />
                            <span className="text-sm font-medium">Ticks the Take With box</span>
                        </label>

                        <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl bg-zinc-100 px-3 sm:col-span-2 dark:bg-zinc-700">
                            <input
                                type="checkbox"
                                checked={showOnSalesSheet}
                                onChange={(e) => setShowOnSalesSheet(e.target.checked)}
                                className="h-5 w-5 accent-sky-600"
                            />
                            <span className="text-sm">
                                <span className="font-medium">Show on sales sheet</span>
                                <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                                    When off, the row stays on the order but is left off the printed
                                    sheet. A row with a charge always prints.
                                </span>
                            </span>
                        </label>

                        <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl bg-zinc-100 px-3 sm:col-span-2 dark:bg-zinc-700">
                            <input
                                type="checkbox"
                                checked={isActive}
                                onChange={(e) => setIsActive(e.target.checked)}
                                className="h-5 w-5 accent-sky-600"
                            />
                            <span className="text-sm font-medium">Offered on the floor</span>
                        </label>

                        <div className="sm:col-span-2">
                            <SaleEditor
                                draft={sale}
                                onChange={setSale}
                                label="Sale on this option"
                            />
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                Taken off whenever this option is added to an order, until it is
                                turned off. A product can set its own sale on it instead.
                            </p>
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

export default DeliveryOptionList;
