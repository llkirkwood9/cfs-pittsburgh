import { Pressable, ScrollView, TextInput, View } from "react-native";
import type { KeyboardTypeOptions } from "react-native";
import Button from "../Elements/Button";
import FullScreenSheet from "../Elements/FullScreenSheet";
import Grid, { Cell } from "../Elements/Grid";
import Icon from "../Elements/Icon";
import Text from "../Elements/Text";
import { cx } from "../../Lib/ClassNames";
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
    const { value, set, elsewhere, setElsewhere, saving, done } = useCustomerSheet(
        order,
        onSave,
        onClose
    );

    const renderField = (field: CustomerSheetField) => (
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
                    value={value(field.key)}
                    onChangeText={(text) => set(field.key, text)}
                    keyboardType={keyboards[field.keyboard ?? "text"]}
                    autoCapitalize={field.autoCapitalize ?? "sentences"}
                    autoCorrect={false}
                    textContentType={
                        field.keyboard === "email"
                            ? "emailAddress"
                            : field.keyboard === "tel"
                              ? "telephoneNumber"
                              : undefined
                    }
                    accessibilityLabel={field.label}
                    className="min-h-[60px] w-full rounded-2xl border-2 border-zinc-300 bg-white px-4 text-lg text-zinc-900 focus:border-sky-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
            </View>
        </Cell>
    );

    return (
        <FullScreenSheet
            onClose={onClose}
            header={
                <View className="mx-auto w-full max-w-3xl flex-row items-center gap-3 px-5 py-4">
                    <Icon icon="fa-solid fa-hand-holding-heart" className="text-2xl text-white" />
                    <View>
                        <Text className="text-xl font-bold text-white">
                            Where should we deliver?
                        </Text>
                        <Text className="text-sm text-sky-100">
                            Fill this in and hand the device back.
                        </Text>
                    </View>
                </View>
            }
            footer={
                <View className="mx-auto w-full max-w-3xl flex-row gap-3 px-4 py-4">
                    <Button
                        text="Cancel"
                        onClick={onClose}
                        className="min-h-[60px] bg-zinc-500 px-6 text-lg dark:bg-zinc-600"
                    />
                    <Button
                        text="Done"
                        icon="fa-solid fa-check"
                        onClick={done}
                        loading={saving}
                        className="min-h-[60px] flex-1 bg-green-700 text-lg dark:bg-green-600"
                    />
                </View>
            }
        >
            <ScrollView
                className="flex-1"
                contentContainerClassName="px-4 py-5"
                keyboardShouldPersistTaps="handled"
            >
                <View className="mx-auto w-full max-w-3xl">
                    <Grid columns={{ base: 2, sm: 6 }} gap={16}>
                        {CustomerBillingFields.map(renderField)}

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
                                                <Icon
                                                    icon={choice.icon}
                                                    className={cx("text-lg", color)}
                                                />
                                                <Text
                                                    className={cx("text-lg font-semibold", color)}
                                                >
                                                    {choice.label}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </Grid>
                            </View>
                        </Cell>

                        {elsewhere && CustomerDeliveryFields.map(renderField)}

                        {renderField(CustomerReferralField)}
                    </Grid>
                </View>
            </ScrollView>
        </FullScreenSheet>
    );
};

export default CustomerDetailsSheet;
