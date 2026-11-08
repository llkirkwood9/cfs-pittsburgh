import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import { useLockBodyScroll } from "../../Hooks/UseLockBodyScroll";
import { useCustomerSheet } from "@shared/Hooks/useSalesForms";
import {
    CustomerBillingFields,
    CustomerDeliveryFields,
    CustomerReferralField,
    type CustomerSheetField,
} from "@shared/Lib/Sales";
import type { Order } from "@shared/Models/Order";

type Props = {
    order: Order;
    onSave: (changes: Order) => Promise<void>;
    onClose: () => void;
};

/** Each field's width, out of 2 columns on a phone and 6 from a small screen up. */
const BASE_SPAN: Record<CustomerSheetField["span"]["base"], string> = {
    1: "col-span-1",
    2: "col-span-2",
};
const SM_SPAN: Record<CustomerSheetField["span"]["sm"], string> = {
    1: "sm:col-span-1",
    2: "sm:col-span-2",
    3: "sm:col-span-3",
    6: "sm:col-span-6",
};

/**
 * The screen a rep hands the tablet across for. Plain language instead of sales-sheet labels,
 * oversized inputs, and nothing on screen the customer could break - no prices, no line items,
 * no navigation. Everything is saved in one go when they tap Done.
 */
const CustomerDetailsSheet = ({ order, onSave, onClose }: Props) => {
    useLockBodyScroll();

    const { value, set, elsewhere, setElsewhere, saving, done } = useCustomerSheet(
        order,
        onSave,
        onClose
    );

    const renderField = (field: CustomerSheetField) => (
        <label
            key={field.key}
            className={`flex flex-col gap-1.5 ${BASE_SPAN[field.span.base]} ${SM_SPAN[field.span.sm]}`}
        >
            <span className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
                {field.label}
                {field.hint && (
                    <span className="ml-2 text-sm font-normal text-zinc-500 dark:text-zinc-400">
                        {field.hint}
                    </span>
                )}
            </span>
            <input
                value={value(field.key)}
                onChange={(e) => set(field.key, e.target.value)}
                type={field.type ?? "text"}
                inputMode={field.keyboard}
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
                            Fill this in and hand the device back.
                        </p>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-5">
                <div className="mx-auto grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-6">
                    {CustomerBillingFields.map(renderField)}

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

                    {elsewhere && CustomerDeliveryFields.map(renderField)}

                    <div className="col-span-2 mt-2 sm:col-span-6" />
                    {renderField(CustomerReferralField)}
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
                        onClick={done}
                        loading={saving}
                        className="min-h-[60px] flex-1 bg-green-700 text-lg hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                    />
                </div>
            </footer>
        </div>
    );
};

export default CustomerDetailsSheet;
