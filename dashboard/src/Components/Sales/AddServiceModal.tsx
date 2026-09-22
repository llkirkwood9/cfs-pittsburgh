import { useState } from "react";
import Button from "../Elements/Button";
import Modal from "../Elements/Modal";
import { FormatCurrency, TakeWithBlocked } from "../../Lib/ModelHelpers";
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

    // Take With is only on offer while the cart has enough of a tracked item.
    const stockBlock = TakeWithBlocked(parentLine.quantityOnHand, parentLine.quantity ?? 1);

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
            title={`Add shipping or service to ${parentLine.description}`}
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
                {options.map((option) => {
                    const blocked = option.isTakeWith ? stockBlock : null;

                    return (
                        <button
                            key={option.id}
                            type="button"
                            disabled={Boolean(blocked)}
                            onClick={() => setSelectedId(option.id ?? null)}
                            className={`flex min-h-[56px] items-center justify-between rounded-xl px-4 text-left
                                transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                    option.id === selectedId
                                        ? "bg-sky-700 text-white dark:bg-sky-600"
                                        : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                                }`}
                        >
                            <span>
                                <span className="font-semibold">{option.name}</span>
                                {blocked && <span className="block text-xs">{blocked}</span>}
                            </span>
                            <span className="tabular-nums">{FormatCurrency(option.price)}</span>
                        </button>
                    );
                })}
            </div>
        </Modal>
    );
};

export default AddServiceModal;
