import { useState } from "react";
import Button from "../Elements/Button";
import Modal from "../Elements/Modal";
import { FormatCurrency } from "../../Lib/ModelHelpers";
import { Toast } from "../../Lib/Toast";
import type { DeliveryOption } from "../../Models/DeliveryOption";
import type { OrderLine } from "../../Models/OrderLine";

type Props = {
    parentLine: OrderLine;
    options: DeliveryOption[];
    onAdd: (line: OrderLine) => Promise<void>;
    onClose: () => void;
};

/**
 * Attaches a second delivery or in-home service to a line that already has one, which is how the
 * Hampton sheets carry White Glove and Haul Away on the same mattress.
 */
const AddServiceModal = ({ parentLine, options, onAdd, onClose }: Props) => {
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [saving, setSaving] = useState<boolean>(false);

    const handleAdd = async () => {
        if (!selectedId) return Toast.Warning("Pick a service first.");

        setSaving(true);
        await onAdd({
            lineType: "Delivery",
            deliveryOptionId: selectedId,
            parentLineId: parentLine.id,
        });
        setSaving(false);
        onClose();
    };

    return (
        <Modal
            title={`Add service to ${parentLine.description}`}
            onClose={onClose}
            footer={
                <>
                    <Button
                        text="Cancel"
                        onClick={onClose}
                        className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                    />
                    <Button
                        text="Add service"
                        icon="fa-solid fa-plus"
                        onClick={handleAdd}
                        loading={saving}
                        className="bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                    />
                </>
            }
        >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {options.map((option) => (
                    <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedId(option.id ?? null)}
                        className={`flex min-h-[56px] items-center justify-between rounded-xl px-4 text-left
                            transition-colors ${
                                option.id === selectedId
                                    ? "bg-sky-700 text-white dark:bg-sky-600"
                                    : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                            }`}
                    >
                        <span className="font-semibold">{option.name}</span>
                        <span className="tabular-nums">{FormatCurrency(option.price)}</span>
                    </button>
                ))}
            </div>
        </Modal>
    );
};

export default AddServiceModal;
