import { useState } from "react";
import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import { useLockBodyScroll } from "../../Hooks/UseLockBodyScroll";
import { Toast } from "../../Lib/Toast";
import { NormalizeCustomer } from "../../Lib/ModelHelpers";
import type { Order } from "../../Models/Order";

type Props = {
    order: Order;
    onSave: (changes: Order) => Promise<void>;
    onClose: () => void;
};

type Field = {
    key: keyof Order;
    label: string;
    hint?: string;
    span: string;
    type?: "text" | "tel" | "email";
    inputMode?: "text" | "tel" | "email";
    autoCapitalize?: "words" | "characters" | "none";
};

const billingFields: Field[] = [
    {
        key: "billingName",
        label: "Your name",
        span: "col-span-2 sm:col-span-6",
        autoCapitalize: "words",
    },
    {
        key: "billingAddress",
        label: "Street address",
        span: "col-span-2 sm:col-span-6",
        autoCapitalize: "words",
    },
    {
        key: "billingUnit",
        label: "Unit #",
        hint: "Optional",
        span: "col-span-1 sm:col-span-2",
    },
    {
        key: "billingFloor",
        label: "Floor",
        hint: "Optional",
        span: "col-span-1 sm:col-span-2",
    },
    {
        key: "billingSuite",
        label: "Suite #",
        hint: "Optional",
        span: "col-span-2 sm:col-span-2",
    },
    {
        key: "billingCity",
        label: "City",
        span: "col-span-2 sm:col-span-3",
        autoCapitalize: "words",
    },
    {
        key: "billingState",
        label: "State",
        span: "col-span-1 sm:col-span-1",
        autoCapitalize: "characters",
    },
    { key: "billingZip", label: "ZIP code", span: "col-span-1 sm:col-span-2", inputMode: "tel" },
    {
        key: "billingCell",
        label: "Cell phone",
        span: "col-span-2 sm:col-span-3",
        type: "tel",
        inputMode: "tel",
    },
    {
        key: "billingAlt",
        label: "Alternate phone",
        hint: "Optional",
        span: "col-span-2 sm:col-span-3",
        type: "tel",
        inputMode: "tel",
    },
    {
        key: "billingEmail",
        label: "Email",
        span: "col-span-2 sm:col-span-6",
        type: "email",
        inputMode: "email",
        autoCapitalize: "none",
    },
];

// Only asked for when the bed is going somewhere other than the billing address - a gift, a
// college dorm, a second home.
const deliveryFields: Field[] = [
    {
        key: "deliveryName",
        label: "Who is receiving it?",
        span: "col-span-2 sm:col-span-6",
        autoCapitalize: "words",
    },
    {
        key: "deliveryAddress",
        label: "Delivery street address",
        span: "col-span-2 sm:col-span-6",
        autoCapitalize: "words",
    },
    {
        key: "deliveryUnit",
        label: "Unit #",
        hint: "Optional",
        span: "col-span-1 sm:col-span-2",
    },
    {
        key: "deliveryFloor",
        label: "Floor",
        hint: "Optional",
        span: "col-span-1 sm:col-span-2",
    },
    {
        key: "deliverySuite",
        label: "Suite #",
        hint: "Optional",
        span: "col-span-2 sm:col-span-2",
    },
    {
        key: "deliveryCity",
        label: "City",
        span: "col-span-2 sm:col-span-3",
        autoCapitalize: "words",
    },
    {
        key: "deliveryState",
        label: "State",
        span: "col-span-1 sm:col-span-1",
        autoCapitalize: "characters",
    },
    { key: "deliveryZip", label: "ZIP code", span: "col-span-1 sm:col-span-2", inputMode: "tel" },
    {
        key: "deliveryCell",
        label: "Phone at that address",
        hint: "Optional",
        span: "col-span-2 sm:col-span-3",
        type: "tel",
        inputMode: "tel",
    },
    {
        key: "deliveryAlt",
        label: "Alternate phone",
        hint: "Optional",
        span: "col-span-2 sm:col-span-3",
        type: "tel",
        inputMode: "tel",
    },
];

const referralField: Field = {
    key: "referralName",
    label: "Who sent you?",
    hint: "The student or family who invited you, so they get the credit",
    span: "col-span-2 sm:col-span-6",
    autoCapitalize: "words",
};

const deliveryKeys = [...deliveryFields.map((f) => f.key), "deliveryEmail"] as const;

/**
 * The screen a rep hands the tablet across for. Plain language instead of sales-sheet labels,
 * oversized inputs, and nothing on screen the customer could break - no prices, no line items,
 * no navigation. Everything is saved in one go when they tap Done.
 */
const CustomerDetailsSheet = ({ order, onSave, onClose }: Props) => {
    useLockBodyScroll();

    const [form, setForm] = useState<Order>(order);
    const [saving, setSaving] = useState<boolean>(false);
    const [elsewhere, setElsewhere] = useState<boolean>(!(order.deliverySameAsBilling ?? true));

    const set = (key: keyof Order, value: string) =>
        setForm((current) => ({ ...current, [key]: value }));

    const handleDone = async () => {
        if (!(form.billingName ?? "").trim()) return Toast.Warning("Please enter your name.");

        if (elsewhere && !(form.deliveryAddress ?? "").trim())
            return Toast.Warning("Please enter the delivery address.");

        // Delivering to the billing address leaves the sheet's delivery block empty, as the
        // paper form expects, so any address typed and then abandoned is cleared.
        const delivery = Object.fromEntries(
            deliveryKeys.map((key) => [key, elsewhere ? ((form[key] as string | null) ?? "") : ""])
        );

        setSaving(true);
        await onSave(
            NormalizeCustomer({
                id: order.id,
                deliverySameAsBilling: !elsewhere,
                ...delivery,
                billingName: form.billingName ?? "",
                billingAddress: form.billingAddress ?? "",
                billingUnit: form.billingUnit ?? "",
                billingFloor: form.billingFloor ?? "",
                billingSuite: form.billingSuite ?? "",
                billingCity: form.billingCity ?? "",
                billingState: form.billingState ?? "",
                billingZip: form.billingZip ?? "",
                billingCell: form.billingCell ?? "",
                billingAlt: form.billingAlt ?? "",
                billingEmail: form.billingEmail ?? "",
                referralName: form.referralName ?? "",
            })
        );
        setSaving(false);
        onClose();
    };

    const renderField = (field: Field) => (
        <label key={field.key} className={`flex flex-col gap-1.5 ${field.span}`}>
            <span className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
                {field.label}
                {field.hint && (
                    <span className="ml-2 text-sm font-normal text-zinc-500 dark:text-zinc-400">
                        {field.hint}
                    </span>
                )}
            </span>
            <input
                value={(form[field.key] as string | null | undefined) ?? ""}
                onChange={(e) => set(field.key, e.target.value)}
                type={field.type ?? "text"}
                inputMode={field.inputMode}
                autoCapitalize={field.autoCapitalize}
                autoCorrect="off"
                className="min-h-[60px] w-full rounded-2xl border-2 border-zinc-300 bg-white px-4
                    text-lg text-zinc-900 outline-hidden transition-colors
                    focus:border-sky-600 focus:ring-4 focus:ring-sky-600/20
                    dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
        </label>
    );

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-50 dark:bg-zinc-900">
            <header className="shrink-0 bg-sky-700 px-5 py-4 text-white dark:bg-sky-800">
                <div className="mx-auto flex max-w-3xl items-center gap-3">
                    <Icon icon="fa-solid fa-hand-holding-heart" className="text-2xl" />
                    <div>
                        <h1 className="text-xl font-bold leading-tight">
                            Where should we deliver?
                        </h1>
                        <p className="text-sm text-sky-100">
                            Fill this in and hand the tablet back.
                        </p>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-5">
                <div className="mx-auto grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-6">
                    {billingFields.map(renderField)}

                    <div className="col-span-2 mt-2 sm:col-span-6">
                        <p className="mb-2 text-base font-semibold text-zinc-800 dark:text-zinc-100">
                            Where should it be delivered?
                        </p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {[
                                {
                                    value: false,
                                    label: "To the address above",
                                    icon: "fa-solid fa-house",
                                },
                                { value: true, label: "Somewhere else", icon: "fa-solid fa-truck" },
                            ].map((choice) => (
                                <button
                                    key={String(choice.value)}
                                    type="button"
                                    onClick={() => setElsewhere(choice.value)}
                                    className={`flex min-h-[64px] items-center justify-center gap-3 rounded-2xl border-2 px-4
                                        text-lg font-semibold transition-colors ${
                                            elsewhere === choice.value
                                                ? "border-sky-600 bg-sky-50 text-sky-800 dark:border-sky-500 dark:bg-sky-950/50 dark:text-sky-200"
                                                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                                        }`}
                                >
                                    <Icon icon={choice.icon} />
                                    {choice.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {elsewhere && deliveryFields.map(renderField)}

                    <div className="col-span-2 mt-2 sm:col-span-6" />
                    {renderField(referralField)}
                </div>
            </div>

            <footer className="shrink-0 border-t border-zinc-200 bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-zinc-700 dark:bg-zinc-800">
                <div className="mx-auto flex max-w-3xl gap-3">
                    <Button
                        text="Cancel"
                        onClick={onClose}
                        className="min-h-[60px] bg-zinc-500 px-6 text-lg hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                    />
                    <Button
                        text="Done"
                        icon="fa-solid fa-check"
                        onClick={handleDone}
                        loading={saving}
                        className="min-h-[60px] flex-1 bg-green-700 text-lg hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                    />
                </div>
            </footer>
        </div>
    );
};

export default CustomerDetailsSheet;
