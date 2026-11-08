import Button from "../Elements/Button";
import Modal from "../Elements/Modal";
import TextField from "../Elements/TextField";
import { useUpchargeEditor } from "@shared/Hooks/useSalesForms";
import { FormatCurrency } from "@shared/Lib/Format";
import type { OrderLine } from "@shared/Models/OrderLine";
import { Limits } from "@shared/Lib/Limits";

type Props = {
    /** The item the upcharge is for. */
    parentLine: OrderLine;
    /** The upcharge being changed; leave out to add a new one. */
    line?: OrderLine;
    onSave: (line: OrderLine) => Promise<void>;
    onClose: () => void;
};

/**
 * Adds an extra charge to an item, with the reason - a special order, a custom size, a rush. It
 * goes on its own row under the item, the way a service does. The amount is per item, so it
 * follows the item's quantity, and it is taxed when the item is.
 */
const UpchargeModal = ({ parentLine, line, onSave, onClose }: Props) => {
    const { reason, setReason, amount, setAmount, quantity, parsed, valid, total, saving, save } =
        useUpchargeEditor(parentLine, line, onSave, onClose);

    return (
        <Modal
            title={line ? "Edit upcharge" : `Add an upcharge to ${parentLine.description}`}
            onClose={onClose}
            footer={
                <>
                    <Button
                        text="Cancel"
                        onClick={onClose}
                        className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                    />
                    <Button
                        text={
                            line
                                ? "Save"
                                : valid
                                  ? `Add upcharge ${FormatCurrency(total)}`
                                  : "Add upcharge"
                        }
                        icon={line ? "fa-solid fa-check" : "fa-solid fa-plus"}
                        onClick={save}
                        loading={saving}
                        className={
                            line
                                ? undefined
                                : "bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                        }
                    />
                </>
            }
        >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <TextField
                    label="Reason"
                    value={reason}
                    onChange={setReason}
                    placeholder="ex. Custom size"
                    className="sm:col-span-2"
                    maxLength={Limits.upchargeReason}
                    autoFocus
                />
                <TextField
                    label={quantity > 1 ? "Amount per item" : "Amount"}
                    value={amount}
                    onChange={setAmount}
                    placeholder="0.00"
                    inputMode="decimal"
                />
            </div>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
                {quantity > 1 && valid
                    ? `${FormatCurrency(parsed)} × ${quantity} = ${FormatCurrency(total)}. `
                    : ""}
                Printed on its own row under the item.{" "}
                {parentLine.isTaxable === false
                    ? "Not taxed, like the item."
                    : "Taxed, like the item."}
                {quantity > 1 && " Charged for each one, so it follows the item's quantity."}
            </p>
        </Modal>
    );
};

export default UpchargeModal;
