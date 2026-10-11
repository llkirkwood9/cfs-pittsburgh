import { useState } from "react";
import { View } from "react-native";
import Button from "../Elements/Button";
import Checkbox from "../Elements/Checkbox";
import DiscountInput from "../Elements/DiscountInput";
import type { DiscountMode } from "../Elements/DiscountInput";
import Grid, { Cell } from "../Elements/Grid";
import Modal from "../Elements/Modal";
import Stepper from "../Elements/Stepper";
import Text from "../Elements/Text";
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
    const [discountMode, setDiscountMode] = useState<DiscountMode>(
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
            return Toast.Warning(`${stockBlock} for Take With. Lower the quantity or ship it instead.`);

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

    const stockNote =
        stockBlock ??
        (line.quantityOnHand !== null && line.quantityOnHand !== undefined
            ? `${line.quantityOnHand} in stock`
            : null);

    return (
        <Modal
            title="Edit line"
            onClose={onClose}
            footer={
                <>
                    <Button text="Cancel" onClick={onClose} className="bg-zinc-500 dark:bg-zinc-600" />
                    <Button text="Save" icon="fa-solid fa-check" onClick={handleSave} loading={saving} />
                </>
            }
        >
            <Grid columns={{ base: 1, sm: 2 }}>
                <Cell span={2}>
                    <TextField
                        label="Description"
                        value={description}
                        onChange={setDescription}
                        maxLength={300}
                    />
                </Cell>
                <TextField label="Brand" value={brand} onChange={setBrand} maxLength={100} />
                <TextField label="Size" value={size} onChange={setSize} maxLength={50} />
                <TextField
                    label="Unit price"
                    value={unitPrice}
                    onChange={setUnitPrice}
                    inputMode="decimal"
                />
                <DiscountInput
                    label={HasDiscount(sale) ? "Extra discount" : "Discount"}
                    mode={discountMode}
                    onModeChange={setDiscountMode}
                    value={discount}
                    onChange={setDiscount}
                />

                {(HasDiscount(sale) || choices) && (
                    <Cell span={2}>
                        <View className="rounded-lg bg-zinc-100 px-3 py-2 dark:bg-zinc-700">
                            {choices && <Text className="text-sm">{choices}</Text>}
                            {HasDiscount(sale) && (
                                <Text className="text-sm">
                                    On sale at {DiscountText(sale)} off when it was added
                                    {(line.unitPrice ?? 0) > 0 && ` (from ${FormatCurrency(line.unitPrice)})`}
                                    . Any extra discount comes off the sale price.
                                </Text>
                            )}
                        </View>
                    </Cell>
                )}

                <Stepper label="Quantity" value={quantity} onChange={setQuantity} />

                <View className="justify-end gap-2">
                    <Checkbox
                        label="Take with"
                        hint={
                            stockNote ? (
                                <Text
                                    className={
                                        stockBlock
                                            ? "text-xs text-amber-700 dark:text-amber-400"
                                            : "text-xs text-zinc-500 dark:text-zinc-400"
                                    }
                                >
                                    {stockNote}
                                </Text>
                            ) : undefined
                        }
                        checked={takeWith}
                        disabled={!takeWith && Boolean(stockBlock)}
                        onChange={setTakeWith}
                    />
                    <Checkbox label="Taxable" checked={isTaxable} onChange={setIsTaxable} />
                </View>

                {/* Notes belong to the item, not its shipping row. */}
                {line.lineType !== "Delivery" && (
                    <Cell span={2}>
                        <TextArea
                            label="Note"
                            value={notes}
                            onChange={setNotes}
                            placeholder="e.g. Floor model - small scuff on the corner"
                            maxLength={500}
                        />
                    </Cell>
                )}
            </Grid>
        </Modal>
    );
};

export default EditLineModal;
