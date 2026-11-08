import Button from "../Elements/Button";
import Modal from "../Elements/Modal";
import { useServicePicker } from "@shared/Hooks/useSalesForms";
import { FormatCurrency } from "@shared/Lib/Format";
import { DiscountText, HasDiscount } from "@shared/Lib/Pricing";
import type { DeliveryOption } from "@shared/Models/DeliveryOption";
import type { OrderLine } from "@shared/Models/OrderLine";
import type { Product } from "@shared/Models/Product";

type Props = {
    parentLine: OrderLine;
    options: DeliveryOption[];
    /** The catalog, for the price and sale the item's own product sets for each option. */
    products?: Product[];
    onAdd: (line: OrderLine) => Promise<void>;
    onClose: () => void;
};

/**
 * Attaches a second delivery or in-home service to a line that already has one, which is how the
 * Hampton sheets carry White Glove and Haul Away on the same mattress. Each option shows the price
 * and catalog sale the item's product sets for it (or the option's own). A rep's discount on the
 * service is given afterwards, with Edit on its row.
 */
const AddServiceModal = ({ parentLine, options, products = [], onAdd, onClose }: Props) => {
    const { selectedId, setSelectedId, blockedFor, pricing, chosen, saving, add } =
        useServicePicker(parentLine, options, products, onAdd, onClose);

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
                        text={
                            chosen
                                ? `Add service ${FormatCurrency(chosen.salePrice)}`
                                : "Add service"
                        }
                        icon="fa-solid fa-plus"
                        onClick={add}
                        loading={saving}
                        className="bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                    />
                </>
            }
        >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {options.map((option) => {
                    const blocked = blockedFor(option);
                    const { price, sale, salePrice } = pricing(option);

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
                                {price > 0 && HasDiscount(sale) && (
                                    <span className="block text-xs">
                                        Sale {DiscountText(sale)} off
                                    </span>
                                )}
                            </span>
                            <span className="text-right tabular-nums">
                                {price > 0 && HasDiscount(sale) ? (
                                    <>
                                        <s className="block text-xs opacity-70">
                                            {FormatCurrency(price)}
                                        </s>
                                        {FormatCurrency(salePrice)}
                                    </>
                                ) : (
                                    FormatCurrency(price)
                                )}
                            </span>
                        </button>
                    );
                })}
            </div>
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                To take something off a service, add it, then use Edit on its row.
            </p>
        </Modal>
    );
};

export default AddServiceModal;
