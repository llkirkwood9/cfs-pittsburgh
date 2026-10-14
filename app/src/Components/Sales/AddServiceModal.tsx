import { useState } from "react";
import { Pressable, View } from "react-native";
import Button from "../Elements/Button";
import Grid from "../Elements/Grid";
import Modal from "../Elements/Modal";
import Text from "../Elements/Text";
import { cx } from "../../Lib/ClassNames";
import { FormatCurrency, TakeWithBlocked } from "../../Lib/ModelHelpers";
import { ApplyDiscount, DeliverySaleFor, DiscountText, HasDiscount } from "../../Lib/Pricing";
import { Toast } from "../../Lib/Toast";
import type { DeliveryOption } from "../../Models/DeliveryOption";
import type { OrderLine } from "../../Models/OrderLine";
import type { Product } from "../../Models/Product";

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
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [saving, setSaving] = useState<boolean>(false);

    // Take With is only on offer while the cart has enough of a tracked item it keeps.
    const stockBlock = TakeWithBlocked(
        parentLine.quantityOnHand,
        parentLine.quantity ?? 1,
        parentLine.notKeptAtCart
    );

    const parentProduct = products.find((p) =>
        (p.variants ?? []).some((v) => v.id === parentLine.productVariantId)
    );
    const pricing = (option: DeliveryOption) => {
        const forProduct = parentProduct?.deliveryOptions?.find(
            (d) => d.deliveryOptionId === option.id
        );
        const price = forProduct?.price ?? option.price ?? 0;
        const sale = DeliverySaleFor(forProduct, option);
        return { price, sale, salePrice: ApplyDiscount(price, sale) };
    };

    const selected = options.find((o) => o.id === selectedId);
    const chosen = selected ? pricing(selected) : null;

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
                    <Button text="Cancel" onClick={onClose} className="bg-zinc-500 dark:bg-zinc-600" />
                    <Button
                        text={chosen ? `Add service ${FormatCurrency(chosen.salePrice)}` : "Add service"}
                        icon="fa-solid fa-plus"
                        onClick={handleAdd}
                        loading={saving}
                        className="bg-green-700 dark:bg-green-600"
                    />
                </>
            }
        >
            <Grid columns={{ base: 1, sm: 2 }} gap={8}>
                {options.map((option) => {
                    const blocked = option.isTakeWith ? stockBlock : null;
                    const { price, sale, salePrice } = pricing(option);
                    const active = option.id === selectedId;
                    const color = active ? "text-white" : "text-zinc-800 dark:text-zinc-100";

                    return (
                        <Pressable
                            key={option.id}
                            disabled={Boolean(blocked)}
                            onPress={() => setSelectedId(option.id ?? null)}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: active, disabled: Boolean(blocked) }}
                            className={cx(
                                "min-h-[56px] flex-row items-center justify-between rounded-xl px-4 py-2",
                                active
                                    ? "bg-sky-700 dark:bg-sky-600"
                                    : "bg-zinc-100 active:bg-zinc-200 dark:bg-zinc-700 dark:active:bg-zinc-600",
                                blocked && "opacity-50"
                            )}
                        >
                            <View className="flex-1">
                                <Text className={cx("font-semibold", color)}>{option.name}</Text>
                                {blocked && <Text className={cx("text-xs", color)}>{blocked}</Text>}
                                {price > 0 && HasDiscount(sale) && (
                                    <Text className={cx("text-xs", color)}>
                                        Sale {DiscountText(sale)} off
                                    </Text>
                                )}
                            </View>
                            <View className="items-end">
                                {price > 0 && HasDiscount(sale) && (
                                    <Text className={cx("text-xs line-through opacity-70", color)}>
                                        {FormatCurrency(price)}
                                    </Text>
                                )}
                                <Text className={cx("tabular-nums", color)}>
                                    {FormatCurrency(price > 0 && HasDiscount(sale) ? salePrice : price)}
                                </Text>
                            </View>
                        </Pressable>
                    );
                })}
            </Grid>
        </Modal>
    );
};

export default AddServiceModal;
