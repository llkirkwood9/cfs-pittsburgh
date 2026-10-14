import { useState } from "react";
import Button from "../Elements/Button";
import Grid, { Cell } from "../Elements/Grid";
import Modal from "../Elements/Modal";
import Text from "../Elements/Text";
import TextField from "../Elements/TextField";
import { FormatCurrency, ParseMoney } from "../../Lib/ModelHelpers";
import { Toast } from "../../Lib/Toast";
import type { OrderLine } from "../../Models/OrderLine";

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
    const [reason, setReason] = useState<string>(line?.description ?? "");
    const [amount, setAmount] = useState<string>(line?.unitPrice ? String(line.unitPrice) : "");
    const [saving, setSaving] = useState<boolean>(false);

    const quantity = parentLine.quantity ?? 1;
    const parsed = ParseMoney(amount) ?? 0;
    const valid = parsed > 0;

    const handleSave = async () => {
        if (!reason.trim()) return Toast.Warning("Enter the reason for the upcharge.");
        if (!valid) return Toast.Warning("Enter the upcharge amount.");

        setSaving(true);
        await onSave(
            line
                ? { id: line.id, description: reason.trim(), unitPrice: parsed }
                : {
                      lineType: "Upcharge",
                      parentLineId: parentLine.id,
                      description: reason.trim(),
                      unitPrice: parsed,
                  }
        );
        setSaving(false);
        onClose();
    };

    const total = valid ? parsed * quantity : 0;

    return (
        <Modal
            title={line ? "Edit upcharge" : `Add an upcharge to ${parentLine.description}`}
            onClose={onClose}
            footer={
                <>
                    <Button text="Cancel" onClick={onClose} className="bg-zinc-500 dark:bg-zinc-600" />
                    <Button
                        text={
                            line
                                ? "Save"
                                : valid
                                  ? `Add upcharge ${FormatCurrency(total)}`
                                  : "Add upcharge"
                        }
                        icon={line ? "fa-solid fa-check" : "fa-solid fa-plus"}
                        onClick={handleSave}
                        loading={saving}
                        className={line ? undefined : "bg-green-700 dark:bg-green-600"}
                    />
                </>
            }
        >
            <Grid columns={{ base: 1, sm: 3 }}>
                <Cell span={{ base: 1, sm: 2 }}>
                    <TextField
                        label="Reason"
                        value={reason}
                        onChange={setReason}
                        placeholder="ex. Custom size"
                        maxLength={300}
                        autoFocus
                    />
                </Cell>
                <TextField
                    label={quantity > 1 ? "Amount per item" : "Amount"}
                    value={amount}
                    onChange={setAmount}
                    placeholder="0.00"
                    inputMode="decimal"
                />
            </Grid>
            <Text className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
                {quantity > 1 && valid
                    ? `${FormatCurrency(parsed)} × ${quantity} = ${FormatCurrency(total)}. `
                    : ""}
                {parentLine.isTaxable === false ? "Not taxed, like the item." : "Taxed, like the item."}
                {quantity > 1 && " Charged for each one, so it follows the item's quantity."}
            </Text>
        </Modal>
    );
};

export default UpchargeModal;
