import { useState } from "react";
import TextField from "../Elements/TextField";
import type { Order } from "../../Models/Order";

type Props = {
    order: Order;
    reps: string[];
    disabled?: boolean;
    onSave: (changes: Order) => Promise<void>;
};

/**
 * The header row, billing block and delivery block of the sales sheet. Fields save on blur so a
 * rep who gets interrupted mid-order never loses what they already typed.
 *
 * The caller keys this component by order id, so switching drafts remounts it with fresh state.
 * That is deliberate: syncing the server copy back into the inputs would overwrite whatever the
 * rep is part way through typing.
 */
const CustomerForm = ({ order, reps, disabled = false, onSave }: Props) => {
    const [form, setForm] = useState<Order>(order);

    const set = (field: keyof Order) => (value: string) =>
        setForm((current) => ({ ...current, [field]: value }));

    const commit = (field: keyof Order) => async () => {
        if ((form[field] ?? "") === (order[field] ?? "")) return;
        await onSave({ id: order.id, [field]: form[field] ?? "" } as Order);
    };

    const toggleSameAsBilling = async (checked: boolean) => {
        setForm((current) => ({ ...current, deliverySameAsBilling: checked }));
        await onSave({ id: order.id, deliverySameAsBilling: checked });
    };

    const field = (
        label: string,
        key: keyof Order,
        options?: { className?: string; inputMode?: "text" | "tel" | "email"; type?: "text" | "email" | "tel" }
    ) => (
        <TextField
            label={label}
            value={(form[key] as string | null | undefined) ?? ""}
            onChange={set(key)}
            onBlur={commit(key)}
            disabled={disabled}
            className={options?.className}
            inputMode={options?.inputMode}
            type={options?.type}
        />
    );

    return (
        <div className="space-y-5">
            <section>
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Sale details
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {field("Organization", "organization")}
                    {field("Advertising source", "advertisingSource")}
                    {field("Referral name", "referralName")}

                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            CFS rep name
                        </span>
                        <input
                            list="cfs-reps"
                            value={form.cfsRepName ?? ""}
                            onChange={(e) => set("cfsRepName")(e.target.value)}
                            onBlur={commit("cfsRepName")}
                            disabled={disabled}
                            className="min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-3 text-base
                                text-zinc-900 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-600/30
                                disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                        <datalist id="cfs-reps">
                            {reps.map((rep) => (
                                <option key={rep} value={rep} />
                            ))}
                        </datalist>
                    </label>
                </div>
            </section>

            <section>
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Customer billing name and address
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                    {field("Name", "billingName", { className: "col-span-2 lg:col-span-3" })}
                    {field("Address", "billingAddress", { className: "col-span-2 lg:col-span-3" })}
                    {field("Unit #", "billingUnit")}
                    {field("Floor", "billingFloor")}
                    {field("Suite #", "billingSuite")}
                    {field("City", "billingCity", { className: "col-span-2 lg:col-span-1" })}
                    {field("State", "billingState")}
                    {field("Zip", "billingZip", { inputMode: "tel" })}
                    {field("Cell #", "billingCell", { type: "tel", inputMode: "tel", className: "col-span-2" })}
                    {field("Alt. #", "billingAlt", { type: "tel", inputMode: "tel", className: "col-span-2" })}
                    {field("Email", "billingEmail", { type: "email", inputMode: "email", className: "col-span-2" })}
                </div>
            </section>

            <section>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Delivery address
                    </h3>
                    <label className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded-lg px-2 text-sm">
                        <input
                            type="checkbox"
                            checked={form.deliverySameAsBilling ?? true}
                            onChange={(e) => toggleSameAsBilling(e.target.checked)}
                            disabled={disabled}
                            className="h-5 w-5 accent-sky-600"
                        />
                        <span className="text-zinc-700 dark:text-zinc-300">Same as billing</span>
                    </label>
                </div>

                {!(form.deliverySameAsBilling ?? true) && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                        {field("Name", "deliveryName", { className: "col-span-2 lg:col-span-3" })}
                        {field("Address", "deliveryAddress", { className: "col-span-2 lg:col-span-3" })}
                        {field("Unit #", "deliveryUnit")}
                        {field("Floor", "deliveryFloor")}
                        {field("Suite #", "deliverySuite")}
                        {field("City", "deliveryCity", { className: "col-span-2 lg:col-span-1" })}
                        {field("State", "deliveryState")}
                        {field("Zip", "deliveryZip", { inputMode: "tel" })}
                        {field("Cell #", "deliveryCell", { type: "tel", inputMode: "tel", className: "col-span-2" })}
                        {field("Alt. #", "deliveryAlt", { type: "tel", inputMode: "tel", className: "col-span-2" })}
                        {field("Email", "deliveryEmail", { type: "email", inputMode: "email", className: "col-span-2" })}
                    </div>
                )}
            </section>

            <section>
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Comments
                </h3>
                <textarea
                    value={form.comments ?? ""}
                    onChange={(e) => set("comments")(e.target.value)}
                    onBlur={commit("comments")}
                    disabled={disabled}
                    rows={3}
                    maxLength={1000}
                    placeholder="Anything the delivery crew or checkout table needs to know"
                    className="w-full rounded-xl border border-zinc-300 bg-white p-3 text-base text-zinc-900
                        outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-600/30 disabled:opacity-60
                        dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
            </section>
        </div>
    );
};

export default CustomerForm;
