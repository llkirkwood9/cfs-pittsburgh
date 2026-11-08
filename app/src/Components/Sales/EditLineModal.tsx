import { View } from "react-native";
import Button from "../Elements/Button";
import Checkbox from "../Elements/Checkbox";
import DiscountInput from "../Elements/DiscountInput";
import Grid, { Cell } from "../Elements/Grid";
import Modal from "../Elements/Modal";
import Stepper from "../Elements/Stepper";
import Text from "../Elements/Text";
import TextArea from "../Elements/TextArea";
import TextField from "../Elements/TextField";
import { useLineEditor } from "@shared/Hooks/useSalesForms";
import { FormatCurrency } from "@shared/Lib/Format";
import { DiscountText, HasDiscount } from "@shared/Lib/Pricing";
import type { OrderLine } from "@shared/Models/OrderLine";

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
                        className="bg-zinc-500 dark:bg-zinc-600"
                    />
                    <Button text="Save" icon="fa-solid fa-check" onClick={save} loading={saving} />
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

                {(HasDiscount(sale) || Boolean(choices)) && (
                    <Cell span={2}>
                        <View className="rounded-lg bg-zinc-100 px-3 py-2 dark:bg-zinc-700">
                            {choices ? <Text className="text-sm">{choices}</Text> : null}
                            {HasDiscount(sale) && (
                                <Text className="text-sm">
                                    On sale at {DiscountText(sale)} off
                                    {(line.unitPrice ?? 0) > 0 &&
                                        ` (from ${FormatCurrency(line.unitPrice)})`}
                                    .
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
                            placeholder="ex. Floor model"
                            maxLength={500}
                        />
                    </Cell>
                )}
            </Grid>
        </Modal>
    );
};

export default EditLineModal;
