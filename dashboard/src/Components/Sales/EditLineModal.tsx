import { useState } from "react";
import Button from "../Elements/Button";
import Modal from "../Elements/Modal";
import TextArea from "../Elements/TextArea";
import TextField from "../Elements/TextField";
import { FormatCurrency, ParseMoney, TakeWithBlocked } from "../../Lib/ModelHelpers";
import { ChoicesText, CleanDiscount, DiscountText, HasDiscount } from "../../Lib/Pricing";
import { Toast } from "../../Lib/Toast";
import type { OrderLine } from "../../Models/OrderLine";

type Props = {
    line: OrderLine;
    onSave: (line: OrderLine) => Promise<void>;
    onClose: () => void;
};

/**
 * Line editor. Everything the Brand / Size / Description / Qty / Take With / Unit Price /
 * Discount columns of the paper sheet can hold is editable here.
 */
const EditLineModal = ({ line, onSave, onClose }: Props) => {
    const [brand, setBrand] = useState<string>(line.brand ?? "");
    const [size, setSize] = useState<string>(line.size ?? "");
    const [description, setDescription] = useState<string>(line.description ?? "");
    const [quantity, setQuantity] = useState<number>(line.quantity ?? 1);
    const [takeWith, setTakeWith] = useState<boolean>(line.takeWith ?? false);
    const [unitPrice, setUnitPrice] = useState<string>(String(line.unitPrice ?? 0));
    // The rep's own discount: a percent, or a fixed amount off each item.
    const [discountMode, setDiscountMode] = useState<"percent" | "amount">(
        (line.discountAmount ?? 0) > 0 && !(line.discountPercent ?? 0) ? "amount" : "percent"
    );
    const [discount, setDiscount] = useState<string>(
        line.discountPercent
            ? String(line.discountPercent)
            : line.discountAmount
              ? String(line.discountAmount)
              : ""
    );
    // The catalog sale it was added with; the rep's discount comes off on top.
    const sale = CleanDiscount(line.saleDiscountPercent, line.saleDiscountAmount);
    const choices = ChoicesText(line.choices);
    const [isTaxable, setIsTaxable] = useState<boolean>(line.isTaxable ?? true);
    const [notes, setNotes] = useState<string>(line.notes ?? "");
    const [saving, setSaving] = useState<boolean>(false);

    // A tracked accessory can only go home today while the cart has enough of it.
    const stockBlock = TakeWithBlocked(line.quantityOnHand, quantity, line.notKeptAtCart);

    const handleSave = async () => {
        if (!description.trim()) return Toast.Warning("The description cannot be blank.");

        const price = ParseMoney(unitPrice);
        if (price === null || price < 0) return Toast.Warning("Enter a valid unit price.");

        const discountValue = ParseMoney(discount);
        if (discount.trim() !== "" && (discountValue === null || discountValue < 0))
            return Toast.Warning("Enter the discount as a number.");
        if (discountMode === "percent" && (discountValue ?? 0) > 100)
            return Toast.Warning("The discount must be between 0 and 100 percent.");

        if (takeWith && stockBlock)
            return Toast.Warning(
                `${stockBlock} for Take With. Lower the quantity or ship it instead.`
            );

        setSaving(true);
        await onSave({
            id: line.id,
            brand: brand.trim(),
            size: size.trim(),
            description: description.trim(),
            quantity,
            takeWith,
            unitPrice: price,
            // Sending one style clears the other on the server.
            ...(discountMode === "percent"
                ? { discountPercent: discountValue ?? 0 }
                : { discountAmount: discountValue ?? 0 }),
            isTaxable,
            notes: line.lineType === "Delivery" ? undefined : notes.trim(),
        });
        setSaving(false);
        onClose();
    };

    return (
        <Modal
            title="Edit line"
            onClose={onClose}
            footer={
                <>
                    <Button
                        text="Cancel"
                        onClick={onClose}
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
                <TextField
                    label="Description"
                    value={description}
                    onChange={setDescription}
                    className="sm:col-span-2"
                    maxLength={300}
                />
                <TextField label="Brand" value={brand} onChange={setBrand} maxLength={100} />
                <TextField label="Size" value={size} onChange={setSize} maxLength={50} />
                <TextField
                    label="Unit price"
                    value={unitPrice}
                    onChange={setUnitPrice}
                    inputMode="decimal"
                />
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        {HasDiscount(sale) ? "Extra discount" : "Discount"}
                    </span>
                    <div className="flex gap-2">
                        <div
                            role="radiogroup"
                            aria-label="Discount type"
                            className="inline-flex shrink-0 overflow-hidden rounded-xl border border-zinc-300 dark:border-zinc-600"
                        >
                            {(["percent", "amount"] as const).map((mode) => (
                                <button
                                    key={mode}
                                    type="button"
                                    role="radio"
                                    aria-checked={discountMode === mode}
                                    onClick={() => setDiscountMode(mode)}
                                    className={`min-h-[48px] w-11 text-base font-bold ${
                                        discountMode === mode
                                            ? "bg-sky-700 text-white dark:bg-sky-600"
                                            : "bg-white text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                                    }`}
                                >
                                    {mode === "percent" ? "%" : "$"}
                                </button>
                            ))}
                        </div>
                        <input
                            value={discount}
                            onChange={(e) => setDiscount(e.target.value)}
                            inputMode="decimal"
                            placeholder="0"
                            aria-label={
                                discountMode === "percent"
                                    ? "Discount percent"
                                    : "Discount amount off each"
                            }
                            className="min-h-[48px] w-full min-w-0 rounded-xl border border-zinc-300 bg-white px-3 text-base
                                text-zinc-900 outline-none focus:border-sky-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                    </div>
                </div>

                {(HasDiscount(sale) || choices) && (
                    <p className="rounded-lg bg-zinc-100 px-3 py-2 text-sm sm:col-span-2 dark:bg-zinc-700">
                        {choices && <span className="block">{choices}</span>}
                        {HasDiscount(sale) && (
                            <span className="block">
                                On sale at {DiscountText(sale)} off when it was added
                                {(line.unitPrice ?? 0) > 0 &&
                                    ` (from ${FormatCurrency(line.unitPrice)})`}
                                . Any extra discount comes off the sale price.
                            </span>
                        )}
                    </p>
                )}

                <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Quantity
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            icon="fa-solid fa-minus"
                            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                            className="bg-zinc-500 px-4 hover:bg-zinc-600"
                        />
                        <span className="min-w-[3ch] text-center text-xl font-bold tabular-nums">
                            {quantity}
                        </span>
                        <Button
                            icon="fa-solid fa-plus"
                            onClick={() => setQuantity((q) => q + 1)}
                            className="bg-zinc-500 px-4 hover:bg-zinc-600"
                        />
                    </div>
                </label>

                <div className="flex flex-col justify-end gap-2">
                    <label
                        className={`flex min-h-[48px] items-center gap-3 rounded-xl bg-zinc-100 px-3 dark:bg-zinc-700 ${
                            !takeWith && stockBlock
                                ? "cursor-not-allowed opacity-60"
                                : "cursor-pointer"
                        }`}
                    >
                        <input
                            type="checkbox"
                            checked={takeWith}
                            disabled={!takeWith && Boolean(stockBlock)}
                            onChange={(e) => setTakeWith(e.target.checked)}
                            className="h-5 w-5 accent-sky-600"
                        />
                        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                            Take with
                            {(stockBlock ||
                                (line.quantityOnHand !== null &&
                                    line.quantityOnHand !== undefined)) && (
                                <span
                                    className={`block text-xs font-normal ${
                                        stockBlock
                                            ? "text-amber-700 dark:text-amber-400"
                                            : "text-zinc-500 dark:text-zinc-400"
                                    }`}
                                >
                                    {stockBlock ?? `${line.quantityOnHand} in stock`}
                                </span>
                            )}
                        </span>
                    </label>
                    <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl bg-zinc-100 px-3 dark:bg-zinc-700">
                        <input
                            type="checkbox"
                            checked={isTaxable}
                            onChange={(e) => setIsTaxable(e.target.checked)}
                            className="h-5 w-5 accent-sky-600"
                        />
                        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                            Taxable
                        </span>
                    </label>
                </div>

                {/* Notes belong to the item, not its shipping row. */}
                {line.lineType !== "Delivery" && (
                    <TextArea
                        label="Note"
                        value={notes}
                        onChange={setNotes}
                        placeholder="e.g. Floor model - small scuff on the corner"
                        className="sm:col-span-2"
                        maxLength={500}
                    />
                )}
            </div>
        </Modal>
    );
};

export default EditLineModal;
