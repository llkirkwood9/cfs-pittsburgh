import { useEffect, useState } from "react";
import Button from "../Elements/Button";
import Icon from "../Elements/Icon";
import TextField from "../Elements/TextField";
import { useSettings } from "../../Context/SettingsContext";
import {
    FinancingText,
    FormatCurrency,
    ParseMoney,
    PaymentMethodLabels,
} from "../../Lib/ModelHelpers";
import { Toast } from "../../Lib/Toast";
import type { FinanceOption } from "../../Models/FinanceOption";
import type { Order } from "../../Models/Order";
import type { OrderPayment, PaymentMethod } from "../../Models/OrderPayment";
import { GetFinanceOptions } from "../../Services/FinanceOptionServices";

type Props = {
    order: Order;
    onAdd: (payment: OrderPayment) => Promise<void>;
    onRemove: (paymentId: number) => Promise<void>;
    onMethodChange: (method: PaymentMethod) => Promise<void>;
    /** Takes the card fee off the order, or puts it back. */
    onWaiveFee: (waive: boolean) => Promise<void>;
};

/** The financing type picker's value for Other. */
const OTHER = "__other__";

// Cash and check first: they are the common case at a school fundraiser and carry no card fee.
const methods: { key: PaymentMethod; label: string; icon: string }[] = [
    { key: "Cash", label: PaymentMethodLabels.Cash, icon: "fa-solid fa-money-bill-wave" },
    { key: "Check", label: PaymentMethodLabels.Check, icon: "fa-solid fa-money-check" },
    { key: "VisaMc", label: PaymentMethodLabels.VisaMc, icon: "fa-solid fa-credit-card" },
    { key: "Financing", label: PaymentMethodLabels.Financing, icon: "fa-solid fa-file-signature" },
    { key: "Layaway", label: PaymentMethodLabels.Layaway, icon: "fa-solid fa-box-archive" },
];

/**
 * The Payment Options box at the checkout table. An order can be split across several methods,
 * and the amount field pre-fills with whatever is still owed so the common case is two taps.
 * Financing also takes the financing number and the type of financing, picked from the
 * catalog's financing options - or typed in under Other, when Settings allows it; both print in
 * the sales sheet's comments.
 */
const PaymentPanel = ({ order, onAdd, onRemove, onMethodChange, onWaiveFee }: Props) => {
    const { settings } = useSettings();
    const allowOther = settings.allowOtherFinanceType;
    const [financeOptions, setFinanceOptions] = useState<FinanceOption[]>([]);

    useEffect(() => {
        GetFinanceOptions().then(setFinanceOptions);
    }, []);
    // Cash is the default. It carries no card fee, so the selection shown always matches the
    // total shown; an order already switched to card reopens on card.
    const [method, setMethod] = useState<PaymentMethod>(
        order.applyCcProcessingFee ? "VisaMc" : "Cash"
    );
    const [amount, setAmount] = useState<string>("");
    const [checkNumber, setCheckNumber] = useState<string>("");
    // An option's name, OTHER, or "" before anything is picked.
    const [financeChoice, setFinanceChoice] = useState<string>("");
    const [otherType, setOtherType] = useState<string>("");
    const [financeNumber, setFinanceNumber] = useState<string>("");
    const [saving, setSaving] = useState<boolean>(false);

    const balance = order.balanceDue ?? 0;
    const feeRate = order.ccProcessingFeeRate ?? 0;
    // Shows the tick straight away while the order saves, then follows the saved order.
    const [pendingWaive, setPendingWaive] = useState<boolean | null>(null);
    const waiving = pendingWaive !== null;
    const waived = pendingWaive ?? order.waiveCcProcessingFee ?? false;
    // The No card fee box shows whenever a card is in play: picked now, or already paid with.
    const cardInPlay =
        method === "VisaMc" || (order.payments ?? []).some((p) => p.method === "VisaMc");

    const toggleWaive = async (waive: boolean) => {
        setPendingWaive(waive);
        await onWaiveFee(waive);
        setPendingWaive(null);
    };

    // Picking a method is what turns the card fee on and off, so the customer sees the real
    // total before anything is keyed in rather than after.
    const chooseMethod = async (next: PaymentMethod) => {
        if (next === method) return;

        setMethod(next);
        setAmount("");
        if (feeRate > 0) await onMethodChange(next);
    };

    const handleAdd = async () => {
        const parsed = ParseMoney(amount);
        if (parsed === null || parsed <= 0) return Toast.Warning("Enter an amount to record.");

        if (method === "Check" && !checkNumber.trim())
            return Toast.Warning("Enter the check number.");

        const financing = method === "Financing";
        const financeType = financeChoice === OTHER ? otherType : financeChoice;
        if (financing && financeChoice === OTHER && !otherType.trim())
            return Toast.Warning("Type in the kind of financing.");
        if (financing && !financeType.trim()) return Toast.Warning("Choose the type of financing.");
        if (financing && !financeNumber.trim()) return Toast.Warning("Enter the financing number.");

        setSaving(true);
        await onAdd({
            method,
            amount: parsed,
            checkNumber: method === "Check" ? checkNumber.trim() : undefined,
            financeType: financing ? financeType.trim() : undefined,
            reference: financing ? financeNumber.trim() : undefined,
        });
        setSaving(false);

        setAmount("");
        setCheckNumber("");
        setFinanceChoice("");
        setOtherType("");
        setFinanceNumber("");
    };

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {methods.map((m) => (
                    <button
                        key={m.key}
                        type="button"
                        onClick={() => chooseMethod(m.key)}
                        className={`flex min-h-[56px] items-center justify-center gap-2 rounded-xl px-3
                            text-sm font-semibold transition-colors ${
                                method === m.key
                                    ? "bg-sky-700 text-white dark:bg-sky-600"
                                    : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                            }`}
                    >
                        <Icon icon={m.icon} />
                        {m.label}
                    </button>
                ))}
            </div>

            {feeRate > 0 && (cardInPlay || waived) && (
                <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    {waived ? (
                        <p>
                            <Icon icon="fa-solid fa-circle-info" /> The card processing fee is
                            waived on this order.
                        </p>
                    ) : (
                        method === "VisaMc" && (
                            <p>
                                <Icon icon="fa-solid fa-circle-info" /> A{" "}
                                {(feeRate * 100).toFixed(2).replace(/\.?0+$/, "")}% card processing
                                fee of {FormatCurrency(order.ccProcessingFee)} is included in the
                                total below. Switch to another method, or tick No card fee, to
                                remove it.
                            </p>
                        )
                    )}
                    <label
                        className={`mt-1 inline-flex items-center gap-2 font-medium ${
                            waiving ? "cursor-wait opacity-60" : "cursor-pointer"
                        }`}
                    >
                        <input
                            type="checkbox"
                            checked={waived}
                            disabled={waiving}
                            onChange={(e) => toggleWaive(e.target.checked)}
                            className="h-4 w-4 accent-amber-600"
                        />
                        No card fee on this order
                    </label>
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField
                    label="Amount"
                    value={amount}
                    onChange={setAmount}
                    inputMode="decimal"
                    placeholder={FormatCurrency(balance)}
                />
                {method === "Check" && (
                    <TextField
                        label="Check #"
                        value={checkNumber}
                        onChange={setCheckNumber}
                        inputMode="numeric"
                    />
                )}
                {method === "Financing" &&
                    (financeOptions.length > 0 || allowOther ? (
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                Financing type
                            </span>
                            <select
                                value={financeChoice}
                                onChange={(e) => setFinanceChoice(e.target.value)}
                                className="min-h-[48px] rounded-xl border border-zinc-300 bg-white px-3 text-base
                                    text-zinc-900 outline-hidden focus:border-sky-600
                                    dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                            >
                                <option value="">Choose...</option>
                                {financeOptions.map((option) => (
                                    <option key={option.id} value={option.name}>
                                        {option.name}
                                    </option>
                                ))}
                                {allowOther && <option value={OTHER}>Other</option>}
                            </select>
                        </label>
                    ) : (
                        <p className="self-end rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                            <Icon icon="fa-solid fa-circle-info" /> No financing options are set up.
                            An administrator adds them in Catalog, under Financing Options.
                        </p>
                    ))}
                {method === "Financing" && financeChoice === OTHER && (
                    <TextField
                        label="Other financing type"
                        value={otherType}
                        onChange={setOtherType}
                        maxLength={100}
                        placeholder="ex. 12 months SAC"
                        className="sm:col-span-2"
                    />
                )}
                {method === "Financing" && (
                    <TextField
                        label="Financing #"
                        value={financeNumber}
                        onChange={setFinanceNumber}
                        maxLength={100}
                        className="sm:col-span-2"
                    />
                )}
            </div>

            <div className="flex flex-wrap gap-2">
                {balance > 0 && (
                    <Button
                        text={`Fill ${FormatCurrency(balance)}`}
                        icon="fa-solid fa-wand-magic-sparkles"
                        onClick={() => setAmount(balance.toFixed(2))}
                        className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                    />
                )}
                <Button
                    text="Record payment"
                    icon="fa-solid fa-plus"
                    onClick={handleAdd}
                    loading={saving}
                    className="flex-1 bg-green-700 hover:bg-green-800 sm:flex-none dark:bg-green-600 dark:hover:bg-green-700"
                />
            </div>

            {(order.payments ?? []).length > 0 && (
                <ul className="space-y-2 pt-1">
                    {(order.payments ?? []).map((payment) => (
                        <li
                            key={payment.id}
                            className="flex items-center gap-3 rounded-xl bg-zinc-100 px-3 py-2 dark:bg-zinc-700"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                    {methods.find((m) => m.key === payment.method)?.label ??
                                        payment.method}
                                </p>
                                {payment.checkNumber && (
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                        Check #{payment.checkNumber}
                                    </p>
                                )}
                                {payment.method === "Financing" && FinancingText(payment) && (
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                        {FinancingText(payment)}
                                    </p>
                                )}
                            </div>
                            <p className="tabular-nums font-bold text-zinc-900 dark:text-zinc-100">
                                {FormatCurrency(payment.amount)}
                            </p>
                            {order.status !== "Completed" && (
                                <button
                                    type="button"
                                    onClick={() => payment.id && onRemove(payment.id)}
                                    aria-label="Remove payment"
                                    className="flex h-10 w-10 items-center justify-center rounded-lg text-red-700
                                        hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-950/40"
                                >
                                    <Icon icon="fa-solid fa-trash" />
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default PaymentPanel;
