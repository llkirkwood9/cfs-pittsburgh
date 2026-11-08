import { Pressable, View } from "react-native";
import Button from "../Elements/Button";
import Checkbox from "../Elements/Checkbox";
import Grid, { Cell } from "../Elements/Grid";
import Icon from "../Elements/Icon";
import SelectField from "../Elements/SelectField";
import Text from "../Elements/Text";
import TextField from "../Elements/TextField";
import { useSettingsFor } from "@shared/Context/SettingsContext";
import { cx } from "../../Lib/ClassNames";
import { OTHER_FINANCE, useCheckoutPayment } from "@shared/Hooks/useCheckoutForms";
import { PaymentMethods } from "@shared/Lib/Checkout";
import { FormatCurrency, FormatRate } from "@shared/Lib/Format";
import { FinancingText, PaymentMethodLabels } from "@shared/Lib/Orders";
import type { Order } from "@shared/Models/Order";
import type { OrderPayment, PaymentMethod } from "@shared/Models/OrderPayment";
import { Limits } from "@shared/Lib/Limits";

type Props = {
    order: Order;
    onAdd: (payment: OrderPayment) => Promise<void>;
    onRemove: (paymentId: number) => Promise<void>;
    onMethodChange: (method: PaymentMethod) => Promise<void>;
    /** Takes the card fee off the order, or puts it back. */
    onWaiveFee: (waive: boolean) => Promise<void>;
};

/**
 * The Payment Options box at the checkout table. An order can be split across several methods,
 * and the amount field pre-fills with whatever is still owed so the common case is two taps.
 * Financing also takes the financing number and the type of financing, picked from the
 * catalog's financing options - or typed in under Other, when Settings allows it; both print in
 * the sales sheet's comments.
 */
const PaymentPanel = ({ order, onAdd, onRemove, onMethodChange, onWaiveFee }: Props) => {
    // The finance options and Other setting of the territory the order was taken in.
    const allowOther = useSettingsFor(order.territoryId).allowOtherFinanceType;
    const {
        financeOptions,
        method,
        chooseMethod,
        amount,
        setAmount,
        checkNumber,
        setCheckNumber,
        financeChoice,
        setFinanceChoice,
        otherType,
        setOtherType,
        financeNumber,
        setFinanceNumber,
        balance,
        feeRate,
        waiving,
        waived,
        toggleWaive,
        cardInPlay,
        saving,
        add,
    } = useCheckoutPayment(order, onAdd, onMethodChange, onWaiveFee);

    return (
        <View className="gap-3">
            <Grid columns={{ base: 2, sm: 3 }} gap={8}>
                {PaymentMethods.map((m) => {
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
                                A {FormatRate(feeRate)} card processing fee of{" "}
                                {FormatCurrency(order.ccProcessingFee)} is included.
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
                                ...(allowOther ? [{ value: OTHER_FINANCE, label: "Other" }] : []),
                            ]}
                        />
                    ) : (
                        <View className="flex-row gap-2 rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-950/40">
                            <Icon
                                icon="fa-solid fa-circle-info"
                                className="text-sm text-amber-800 dark:text-amber-300"
                            />
                            <Text className="flex-1 text-sm text-amber-800 dark:text-amber-300">
                                No financing options are set up.
                            </Text>
                        </View>
                    ))}
                {method === "Financing" && financeChoice === OTHER_FINANCE && (
                    <Cell span={2}>
                        <TextField
                            label="Other financing type"
                            value={otherType}
                            onChange={setOtherType}
                            maxLength={Limits.financeType}
                            placeholder="ex. 12 months SAC"
                        />
                    </Cell>
                )}
                {method === "Financing" && (
                    <Cell span={2}>
                        <TextField
                            label="Financing #"
                            value={financeNumber}
                            onChange={setFinanceNumber}
                            maxLength={Limits.financeNumber}
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
                    onClick={add}
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
                                    {PaymentMethodLabels[payment.method as PaymentMethod] ??
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
                                    <Icon
                                        icon="fa-solid fa-trash"
                                        className="text-red-700 dark:text-red-400"
                                    />
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
