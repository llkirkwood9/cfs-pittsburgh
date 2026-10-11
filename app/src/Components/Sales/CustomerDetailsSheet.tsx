import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import type { KeyboardTypeOptions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Button from "../Elements/Button";
import Grid, { Cell } from "../Elements/Grid";
import Icon from "../Elements/Icon";
import Text from "../Elements/Text";
import ToastHost from "../Elements/ToastHost";
import { cx } from "../../Lib/ClassNames";
import { NormalizeCustomer } from "../../Lib/ModelHelpers";
import { Toast } from "../../Lib/Toast";
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
    /** Columns out of 2 on a phone and 6 from a small tablet up, like the dashboard's spans. */
    span: { base: number; sm: number };
    type?: "text" | "tel" | "email";
    autoCapitalize?: "words" | "characters" | "none";
};

const billingFields: Field[] = [
    { key: "billingName", label: "Your name", span: { base: 2, sm: 6 }, autoCapitalize: "words" },
    {
        key: "billingAddress",
        label: "Street address",
        span: { base: 2, sm: 6 },
        autoCapitalize: "words",
    },
    { key: "billingUnit", label: "Unit #", hint: "Optional", span: { base: 1, sm: 2 } },
    { key: "billingFloor", label: "Floor", hint: "Optional", span: { base: 1, sm: 2 } },
    { key: "billingSuite", label: "Suite #", hint: "Optional", span: { base: 2, sm: 2 } },
    { key: "billingCity", label: "City", span: { base: 2, sm: 3 }, autoCapitalize: "words" },
    { key: "billingState", label: "State", span: { base: 1, sm: 1 }, autoCapitalize: "characters" },
    { key: "billingZip", label: "ZIP code", span: { base: 1, sm: 2 }, type: "tel" },
    { key: "billingCell", label: "Cell phone", span: { base: 2, sm: 3 }, type: "tel" },
    {
        key: "billingAlt",
        label: "Alternate phone",
        hint: "Optional",
        span: { base: 2, sm: 3 },
        type: "tel",
    },
    {
        key: "billingEmail",
        label: "Email",
        span: { base: 2, sm: 6 },
        type: "email",
        autoCapitalize: "none",
    },
];

// Only asked for when the bed is going somewhere other than the billing address - a gift, a
// college dorm, a second home.
const deliveryFields: Field[] = [
    {
        key: "deliveryName",
        label: "Who is receiving it?",
        span: { base: 2, sm: 6 },
        autoCapitalize: "words",
    },
    {
        key: "deliveryAddress",
        label: "Delivery street address",
        span: { base: 2, sm: 6 },
        autoCapitalize: "words",
    },
    { key: "deliveryUnit", label: "Unit #", hint: "Optional", span: { base: 1, sm: 2 } },
    { key: "deliveryFloor", label: "Floor", hint: "Optional", span: { base: 1, sm: 2 } },
    { key: "deliverySuite", label: "Suite #", hint: "Optional", span: { base: 2, sm: 2 } },
    { key: "deliveryCity", label: "City", span: { base: 2, sm: 3 }, autoCapitalize: "words" },
    {
        key: "deliveryState",
        label: "State",
        span: { base: 1, sm: 1 },
        autoCapitalize: "characters",
    },
    { key: "deliveryZip", label: "ZIP code", span: { base: 1, sm: 2 }, type: "tel" },
    {
        key: "deliveryCell",
        label: "Phone at that address",
        hint: "Optional",
        span: { base: 2, sm: 3 },
        type: "tel",
    },
    {
        key: "deliveryAlt",
        label: "Alternate phone",
        hint: "Optional",
        span: { base: 2, sm: 3 },
        type: "tel",
    },
];

const referralField: Field = {
    key: "referralName",
    label: "Who sent you?",
    hint: "The student or family who invited you, so they get the credit",
    span: { base: 2, sm: 6 },
    autoCapitalize: "words",
};

const deliveryKeys = [...deliveryFields.map((f) => f.key), "deliveryEmail"] as const;

const keyboards: Record<string, KeyboardTypeOptions> = {
    tel: "phone-pad",
    email: "email-address",
    text: "default",
};

/**
 * The screen a rep hands the tablet across for. Plain language instead of sales-sheet labels,
 * oversized inputs, and nothing on screen the customer could break - no prices, no line items,
 * no navigation, and it can't be swiped away. Everything is saved in one go when they tap Done.
 */
const CustomerDetailsSheet = ({ order, onSave, onClose }: Props) => {
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
        <Cell key={field.key} span={field.span}>
            <View className="gap-1.5">
                <Text className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
                    {field.label}
                    {field.hint && (
                        <Text className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
                            {"  "}
                            {field.hint}
                        </Text>
                    )}
                </Text>
                <TextInput
                    value={(form[field.key] as string | null | undefined) ?? ""}
                    onChangeText={(value) => set(field.key, value)}
                    keyboardType={keyboards[field.type ?? "text"]}
                    autoCapitalize={field.autoCapitalize ?? "sentences"}
                    autoCorrect={false}
                    textContentType={
                        field.type === "email"
                            ? "emailAddress"
                            : field.type === "tel"
                              ? "telephoneNumber"
                              : undefined
                    }
                    accessibilityLabel={field.label}
                    className="min-h-[60px] w-full rounded-2xl border-2 border-zinc-300 bg-white px-4
                        text-lg text-zinc-900 focus:border-sky-600
                        dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
            </View>
        </Cell>
    );

    return (
        <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
            <View className="flex-1 bg-zinc-50 dark:bg-zinc-900">
                <SafeAreaView edges={["top"]} className="bg-sky-700 dark:bg-sky-800">
                    <View className="mx-auto w-full max-w-3xl flex-row items-center gap-3 px-5 py-4">
                        <Icon icon="fa-solid fa-hand-holding-heart" className="text-2xl text-white" />
                        <View>
                            <Text className="text-xl font-bold text-white">Where should we deliver?</Text>
                            <Text className="text-sm text-sky-100">
                                Fill this in and hand the tablet back.
                            </Text>
                        </View>
                    </View>
                </SafeAreaView>

                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                    className="flex-1"
                >
                    <ScrollView
                        className="flex-1"
                        contentContainerClassName="px-4 py-5"
                        keyboardShouldPersistTaps="handled"
                    >
                        <View className="mx-auto w-full max-w-3xl">
                            <Grid columns={{ base: 2, sm: 6 }} gap={16}>
                                {billingFields.map(renderField)}

                                <Cell span={{ base: 2, sm: 6 }}>
                                    <View className="mt-2">
                                        <Text className="mb-2 text-base font-semibold text-zinc-800 dark:text-zinc-100">
                                            Where should it be delivered?
                                        </Text>
                                        <Grid columns={{ base: 1, sm: 2 }}>
                                            {[
                                                {
                                                    value: false,
                                                    label: "To the address above",
                                                    icon: "fa-solid fa-house",
                                                },
                                                {
                                                    value: true,
                                                    label: "Somewhere else",
                                                    icon: "fa-solid fa-truck",
                                                },
                                            ].map((choice) => {
                                                const active = elsewhere === choice.value;
                                                const color = active
                                                    ? "text-sky-800 dark:text-sky-200"
                                                    : "text-zinc-700 dark:text-zinc-200";
                                                return (
                                                    <Pressable
                                                        key={String(choice.value)}
                                                        onPress={() => setElsewhere(choice.value)}
                                                        accessibilityRole="radio"
                                                        accessibilityState={{ checked: active }}
                                                        className={cx(
                                                            "min-h-[64px] flex-row items-center justify-center gap-3 rounded-2xl border-2 px-4",
                                                            active
                                                                ? "border-sky-600 bg-sky-50 dark:border-sky-500 dark:bg-sky-950/50"
                                                                : "border-zinc-300 bg-white active:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:active:bg-zinc-700"
                                                        )}
                                                    >
                                                        <Icon icon={choice.icon} className={cx("text-lg", color)} />
                                                        <Text className={cx("text-lg font-semibold", color)}>
                                                            {choice.label}
                                                        </Text>
                                                    </Pressable>
                                                );
                                            })}
                                        </Grid>
                                    </View>
                                </Cell>

                                {elsewhere && deliveryFields.map(renderField)}

                                {renderField(referralField)}
                            </Grid>
                        </View>
                    </ScrollView>

                    <SafeAreaView
                        edges={["bottom"]}
                        className="border-t border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
                    >
                        <View className="mx-auto w-full max-w-3xl flex-row gap-3 px-4 py-4">
                            <Button
                                text="Cancel"
                                onClick={onClose}
                                className="min-h-[60px] bg-zinc-500 px-6 text-lg dark:bg-zinc-600"
                            />
                            <Button
                                text="Done"
                                icon="fa-solid fa-check"
                                onClick={handleDone}
                                loading={saving}
                                className="min-h-[60px] flex-1 bg-green-700 text-lg dark:bg-green-600"
                            />
                        </View>
                    </SafeAreaView>
                </KeyboardAvoidingView>
            </View>
            <ToastHost />
        </Modal>
    );
};

export default CustomerDetailsSheet;
