import Button from "../Elements/Button";
import Modal from "../Elements/Modal";
import TextArea from "../Elements/TextArea";
import TextField from "../Elements/TextField";
import { useLineEditor } from "@shared/Hooks/useSalesForms";
import { FormatCurrency } from "@shared/Lib/Format";
import { DiscountText, HasDiscount } from "@shared/Lib/Pricing";
import type { OrderLine } from "@shared/Models/OrderLine";
import { Limits } from "@shared/Lib/Limits";

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
    const {
        brand,
        setBrand,
        size,
        setSize,
        description,
        setDescription,
        quantity,
        setQuantity,
        takeWith,
        setTakeWith,
        unitPrice,
        setUnitPrice,
        discountMode,
        setDiscountMode,
        discount,
        setDiscount,
        isTaxable,
        setIsTaxable,
        notes,
        setNotes,
        sale,
        choices,
        stockBlock,
        stockNote,
        saving,
        save,
    } = useLineEditor(line, onSave, onClose);

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
                    <Button text="Save" icon="fa-solid fa-check" onClick={save} loading={saving} />
                </>
            }
        >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField
                    label="Description"
                    value={description}
                    onChange={setDescription}
                    className="sm:col-span-2"
                    maxLength={Limits.lineDescription}
                />
                <TextField
                    label="Brand"
                    value={brand}
                    onChange={setBrand}
                    maxLength={Limits.brand}
                />
                <TextField label="Size" value={size} onChange={setSize} maxLength={Limits.size} />
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
                                text-zinc-900 outline-hidden focus:border-sky-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                    </div>
                </div>

                {(HasDiscount(sale) || choices) && (
                    <p className="rounded-lg bg-zinc-100 px-3 py-2 text-sm sm:col-span-2 dark:bg-zinc-700">
                        {choices && <span className="block">{choices}</span>}
                        {HasDiscount(sale) && (
                            <span className="block">
                                On sale at {DiscountText(sale)} off
                                {(line.unitPrice ?? 0) > 0 &&
                                    ` (from ${FormatCurrency(line.unitPrice)})`}
                                .
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
                            {stockNote && (
                                <span
                                    className={`block text-xs font-normal ${
                                        stockBlock
                                            ? "text-amber-700 dark:text-amber-400"
                                            : "text-zinc-500 dark:text-zinc-400"
                                    }`}
                                >
                                    {stockNote}
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
                        placeholder="ex. Floor model"
                        className="sm:col-span-2"
                        maxLength={Limits.lineNotes}
                    />
                )}
            </div>
        </Modal>
    );
};

export default EditLineModal;
