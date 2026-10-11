import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Button from "../Elements/Button";
import Checkbox from "../Elements/Checkbox";
import Grid, { Cell } from "../Elements/Grid";
import Icon from "../Elements/Icon";
import SelectField from "../Elements/SelectField";
import Text from "../Elements/Text";
import TextField from "../Elements/TextField";
import { useSettings } from "../../Context/SettingsContext";
import { cx } from "../../Lib/ClassNames";
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
    // Shows the switch straight away while the order saves, then follows the saved order.
    const [pendingWaive, setPendingWaive] = useState<boolean | null>(null);
    const waiving = pendingWaive !== null;
    const waived = pendingWaive ?? order.waiveCcProcessingFee ?? false;
    // The No card fee switch shows whenever a card is in play: picked now, or already paid with.
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
        <View className="gap-3">
            <Grid columns={{ base: 2, sm: 3 }} gap={8}>
                {methods.map((m) => {
                    const active = method === m.key;
                    const color = active ? "text-white" : "text-zinc-800 dark:text-zinc-100";
                    return (
                        <Pressable
                            key={m.key}
                            onPress={() => chooseMethod(m.key)}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: active }}
                            className={cx(
                                "min-h-[56px] flex-row items-center justify-center gap-2 rounded-xl px-3",
                                active
                                    ? "bg-sky-700 dark:bg-sky-600"
                                    : "bg-zinc-100 active:bg-zinc-200 dark:bg-zinc-700 dark:active:bg-zinc-600"
                            )}
                        >
                            <Icon icon={m.icon} className={color} />
                            <Text className={cx("text-sm font-semibold", color)}>{m.label}</Text>
                        </Pressable>
                    );
                })}
            </Grid>

            {feeRate > 0 && (cardInPlay || waived) && (
                <View className="gap-2 rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-950/40">
                    {waived ? (
                        <Text className="text-sm text-amber-800 dark:text-amber-300">
                            The card processing fee is waived on this order.
                        </Text>
                    ) : (
                        method === "VisaMc" && (
                            <Text className="text-sm text-amber-800 dark:text-amber-300">
                                A {(feeRate * 100).toFixed(2).replace(/\.?0+$/, "")}% card processing
                                fee of {FormatCurrency(order.ccProcessingFee)} is included in the
                                total below. Switch to another method, or turn on No card fee, to
                                remove it.
                            </Text>
                        )
                    )}
                    <Checkbox
                        label="No card fee on this order"
                        checked={waived}
                        disabled={waiving}
                        onChange={toggleWaive}
                        className="bg-amber-100 dark:bg-amber-900/40"
                    />
                </View>
            )}

            <Grid columns={{ base: 1, sm: 2 }}>
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
                        <SelectField
                            label="Financing type"
                            value={financeChoice}
                            onChange={setFinanceChoice}
                            options={[
                                ...financeOptions.map((option) => ({
                                    value: option.name ?? "",
                                    label: option.name ?? "",
                                })),
                                ...(allowOther ? [{ value: OTHER, label: "Other" }] : []),
                            ]}
                        />
                    ) : (
                        <View className="flex-row gap-2 rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-950/40">
                            <Icon icon="fa-solid fa-circle-info" className="text-sm text-amber-800 dark:text-amber-300" />
                            <Text className="flex-1 text-sm text-amber-800 dark:text-amber-300">
                                No financing options are set up. An administrator adds them in
                                Catalog, under Financing Options.
                            </Text>
                        </View>
                    ))}
                {method === "Financing" && financeChoice === OTHER && (
                    <Cell span={2}>
                        <TextField
                            label="Other financing type"
                            value={otherType}
                            onChange={setOtherType}
                            maxLength={100}
                            placeholder="e.g. 36 months, 9.99% APR"
                        />
                    </Cell>
                )}
                {method === "Financing" && (
                    <Cell span={2}>
                        <TextField
                            label="Financing #"
                            value={financeNumber}
                            onChange={setFinanceNumber}
                            maxLength={100}
                            autoCapitalize="characters"
                        />
                    </Cell>
                )}
            </Grid>

            <View className="flex-row flex-wrap gap-2">
                {balance > 0 && (
                    <Button
                        text={`Fill ${FormatCurrency(balance)}`}
                        icon="fa-solid fa-wand-magic-sparkles"
                        onClick={() => setAmount(balance.toFixed(2))}
                        className="bg-zinc-500 dark:bg-zinc-600"
                    />
                )}
                <Button
                    text="Record payment"
                    icon="fa-solid fa-plus"
                    onClick={handleAdd}
                    loading={saving}
                    className="flex-1 bg-green-700 dark:bg-green-600"
                />
            </View>

            {(order.payments ?? []).length > 0 && (
                <View className="gap-2 pt-1">
                    {(order.payments ?? []).map((payment) => (
                        <View
                            key={payment.id}
                            className="flex-row items-center gap-3 rounded-xl bg-zinc-100 px-3 py-2 dark:bg-zinc-700"
                        >
                            <View className="min-w-0 flex-1">
                                <Text className="text-sm font-semibold">
                                    {methods.find((m) => m.key === payment.method)?.label ??
                                        payment.method}
                                </Text>
                                {payment.checkNumber ? (
                                    <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                                        Check #{payment.checkNumber}
                                    </Text>
                                ) : null}
                                {payment.method === "Financing" && FinancingText(payment) ? (
                                    <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                                        {FinancingText(payment)}
                                    </Text>
                                ) : null}
                            </View>
                            <Text className="font-bold tabular-nums">
                                {FormatCurrency(payment.amount)}
                            </Text>
                            {order.status !== "Completed" && (
                                <Pressable
                                    onPress={() => payment.id && onRemove(payment.id)}
                                    accessibilityRole="button"
                                    accessibilityLabel="Remove payment"
                                    className="h-10 w-10 items-center justify-center rounded-lg active:bg-red-100 dark:active:bg-red-950/40"
                                >
                                    <Icon icon="fa-solid fa-trash" className="text-red-700 dark:text-red-400" />
                                </Pressable>
                            )}
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
};

export default PaymentPanel;
