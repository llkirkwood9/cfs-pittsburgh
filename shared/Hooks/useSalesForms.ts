import { useState } from "react";
import { Toast } from "@host";
import type { DiscountMode } from "../Lib/AddItem";
import { ParseMoney } from "../Lib/Format";
import { TakeWithBlocked } from "../Lib/Inventory";
import { NormalizeCustomerField } from "../Lib/Orders";
import { ChoicesText, CleanDiscount } from "../Lib/Pricing";
import { CustomerSheetChanges, ServicePricing } from "../Lib/Sales";
import type { DeliveryOption } from "../Models/DeliveryOption";
import type { Order } from "../Models/Order";
import type { OrderLine } from "../Models/OrderLine";
import type { Product } from "../Models/Product";

/**
 * The line editor: everything the Brand / Size / Description / Qty / Take With / Unit Price /
 * Discount columns of the paper sheet can hold.
 * @param line The line being edited.
 * @param onSave Saves the changes.
 * @param onClose Closes the editor once saved.
 * @returns The form's state and its save handler.
 */
export const useLineEditor = (
    line: OrderLine,
    onSave: (line: OrderLine) => Promise<void>,
    onClose: () => void
) => {
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
    const [isTaxable, setIsTaxable] = useState<boolean>(line.isTaxable ?? true);
    const [notes, setNotes] = useState<string>(line.notes ?? "");
    const [saving, setSaving] = useState<boolean>(false);

    // A tracked accessory can only go home today while the cart has enough of it.
    const stockBlock = TakeWithBlocked(line.quantityOnHand, quantity, line.notKeptAtCart);
    const stockNote =
        stockBlock ??
        (line.quantityOnHand !== null && line.quantityOnHand !== undefined
            ? `${line.quantityOnHand} in stock`
            : null);

    const save = async () => {
        if (!description.trim()) return void Toast.Warning("The description cannot be blank.");

        const price = ParseMoney(unitPrice);
        if (price === null || price < 0) return void Toast.Warning("Enter a valid unit price.");

        const discountValue = ParseMoney(discount);
        if (discount.trim() !== "" && (discountValue === null || discountValue < 0))
            return void Toast.Warning("Enter the discount as a number.");
        if (discountMode === "percent" && (discountValue ?? 0) > 100)
            return void Toast.Warning("The discount must be between 0 and 100 percent.");

        if (takeWith && stockBlock)
            return void Toast.Warning(
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

    return {
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
        /** The catalog sale it was added with; the rep's discount comes off on top. */
        sale: CleanDiscount(line.saleDiscountPercent, line.saleDiscountAmount),
        choices: ChoicesText(line.choices),
        /** Why it can't go home today, if it can't. */
        stockBlock,
        /** The Take With box's hint: why not, or how many are on hand. */
        stockNote,
        saving,
        save,
    };
};

/**
 * An upcharge on an item - a special order, a custom size, a rush - added or changed. The amount
 * is per item, so it follows the item's quantity.
 * @param parentLine The item it is for.
 * @param line The upcharge being changed; leave out to add a new one.
 * @param onSave Saves it.
 * @param onClose Closes the editor once saved.
 * @returns The form's state and its save handler.
 */
export const useUpchargeEditor = (
    parentLine: OrderLine,
    line: OrderLine | undefined,
    onSave: (line: OrderLine) => Promise<void>,
    onClose: () => void
) => {
    const [reason, setReason] = useState<string>(line?.description ?? "");
    const [amount, setAmount] = useState<string>(line?.unitPrice ? String(line.unitPrice) : "");
    const [saving, setSaving] = useState<boolean>(false);

    const quantity = parentLine.quantity ?? 1;
    const parsed = ParseMoney(amount) ?? 0;
    const valid = parsed > 0;

    const save = async () => {
        if (!reason.trim()) return void Toast.Warning("Enter the reason for the upcharge.");
        if (!valid) return void Toast.Warning("Enter the upcharge amount.");

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

    return {
        reason,
        setReason,
        amount,
        setAmount,
        quantity,
        /** The amount per item, or 0 while it isn't a positive number. */
        parsed,
        valid,
        /** The amount for every item. */
        total: valid ? parsed * quantity : 0,
        saving,
        save,
    };
};

/**
 * Picking a second delivery or in-home service for a line that already has one. Take With is only
 * on offer while the cart has enough of a tracked item it keeps.
 * @param parentLine The item it goes on.
 * @param options The delivery options.
 * @param products The catalog, for the price and sale the item's own product sets.
 * @param onAdd Adds the service.
 * @param onClose Closes the picker once added.
 * @returns The picker's state and its add handler.
 */
export const useServicePicker = (
    parentLine: OrderLine,
    options: DeliveryOption[],
    products: Product[],
    onAdd: (line: OrderLine) => Promise<void>,
    onClose: () => void
) => {
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [saving, setSaving] = useState<boolean>(false);

    const stockBlock = TakeWithBlocked(
        parentLine.quantityOnHand,
        parentLine.quantity ?? 1,
        parentLine.notKeptAtCart
    );
    const pricing = (option: DeliveryOption) => ServicePricing(option, parentLine, products);
    const selected = options.find((o) => o.id === selectedId);

    const add = async () => {
        if (!selectedId) return void Toast.Warning("Pick a service first.");

        setSaving(true);
        await onAdd({
            lineType: "Delivery",
            deliveryOptionId: selectedId,
            parentLineId: parentLine.id,
        });
        setSaving(false);
        onClose();
    };

    return {
        selectedId,
        setSelectedId,
        /** Why an option can't be picked: Take With while the cart is short. */
        blockedFor: (option: DeliveryOption) => (option.isTakeWith ? stockBlock : null),
        pricing,
        /** The pricing of the option picked, if any. */
        chosen: selected ? pricing(selected) : null,
        saving,
        add,
    };
};

/**
 * The rep's customer form. Fields save as the rep moves on, tidied the way the server stores
 * them, so a rep who gets interrupted mid-order never loses what they already typed.
 * @param order The order, as it was when the form opened.
 * @param onSave Saves one change.
 * @returns The form's values and handlers.
 */
export const useCustomerForm = (order: Order, onSave: (changes: Order) => Promise<void>) => {
    const [form, setForm] = useState<Order>(order);

    const set = (field: keyof Order) => (value: string) =>
        setForm((current) => ({ ...current, [field]: value }));

    /** Saves a field's value when it differs from the order's. */
    const commitValue = async (field: keyof Order, raw: unknown) => {
        const value = typeof raw === "string" ? NormalizeCustomerField(field, raw) : (raw ?? "");
        if (value !== raw) setForm((current) => ({ ...current, [field]: value }));

        if ((value ?? "") === (order[field] ?? "")) return;
        await onSave({ id: order.id, [field]: value } as Order);
    };

    /** Saves a field as typed, as the rep leaves it. */
    const commit = (field: keyof Order) => () => commitValue(field, form[field]);

    const toggleSameAsBilling = async (checked: boolean) => {
        setForm((current) => ({ ...current, deliverySameAsBilling: checked }));
        await onSave({ id: order.id, deliverySameAsBilling: checked });
    };

    return {
        form,
        /** A text field's value. */
        text: (field: keyof Order) => (form[field] as string | null | undefined) ?? "",
        set,
        commit,
        commitValue,
        toggleSameAsBilling,
    };
};

/**
 * The customer details sheet a rep hands across: everything saved in one go when they tap Done.
 * @param order The order.
 * @param onSave Saves the details.
 * @param onClose Closes the sheet once saved.
 * @returns The sheet's values and handlers.
 */
export const useCustomerSheet = (
    order: Order,
    onSave: (changes: Order) => Promise<void>,
    onClose: () => void
) => {
    const [form, setForm] = useState<Order>(order);
    const [saving, setSaving] = useState<boolean>(false);
    const [elsewhere, setElsewhere] = useState<boolean>(!(order.deliverySameAsBilling ?? true));

    const set = (key: keyof Order, value: string) =>
        setForm((current) => ({ ...current, [key]: value }));

    const done = async () => {
        const result = CustomerSheetChanges(order.id, form, elsewhere);
        if ("problem" in result) return void Toast.Warning(result.problem);

        setSaving(true);
        await onSave(result.changes);
        setSaving(false);
        onClose();
    };

    return {
        /** A field's value. */
        value: (key: keyof Order) => (form[key] as string | null | undefined) ?? "",
        set,
        elsewhere,
        setElsewhere,
        saving,
        done,
    };
};
