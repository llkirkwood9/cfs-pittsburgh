import { useState } from "react";
import { View } from "react-native";
import Checkbox from "../Elements/Checkbox";
import ComboField from "../Elements/ComboField";
import Grid, { Cell } from "../Elements/Grid";
import Text from "../Elements/Text";
import TextArea from "../Elements/TextArea";
import TextField from "../Elements/TextField";
import { NormalizeCustomerField } from "../../Lib/ModelHelpers";
import type { Order } from "../../Models/Order";

type Props = {
    order: Order;
    reps: string[];
    disabled?: boolean;
    onSave: (changes: Order) => Promise<void>;
};

/** The address blocks: two columns on a phone or a half-width column, four where there's room. */
const ADDRESS_COLUMNS = { base: 2, sm: 4, lg: 2, xl: 4 };

/**
 * The header row, billing block and delivery block of the sales sheet. Fields save when the rep
 * moves on, so a rep who gets interrupted mid-order never loses what they already typed.
 *
 * The caller keys this component by order id, so switching drafts remounts it with fresh state.
 * That is deliberate: syncing the server copy back into the inputs would overwrite whatever the
 * rep is part way through typing.
 */
const CustomerForm = ({ order, reps, disabled = false, onSave }: Props) => {
    const [form, setForm] = useState<Order>(order);

    const set = (field: keyof Order) => (value: string) =>
        setForm((current) => ({ ...current, [field]: value }));

    const commitValue = async (field: keyof Order, raw: unknown) => {
        const value = typeof raw === "string" ? NormalizeCustomerField(field, raw) : (raw ?? "");
        if (value !== raw) setForm((current) => ({ ...current, [field]: value }));

        if ((value ?? "") === (order[field] ?? "")) return;
        await onSave({ id: order.id, [field]: value } as Order);
    };

    const commit = (field: keyof Order) => () => commitValue(field, form[field]);

    const toggleSameAsBilling = async (checked: boolean) => {
        setForm((current) => ({ ...current, deliverySameAsBilling: checked }));
        await onSave({ id: order.id, deliverySameAsBilling: checked });
    };

    const field = (
        label: string,
        key: keyof Order,
        options?: {
            inputMode?: "text" | "tel" | "email";
            type?: "text" | "email" | "tel";
        }
    ) => (
        <TextField
            label={label}
            value={(form[key] as string | null | undefined) ?? ""}
            onChange={set(key)}
            onBlur={commit(key)}
            disabled={disabled}
            inputMode={options?.inputMode}
            type={options?.type}
            autoCapitalize={
                options?.type === "email" ? "none" : key.endsWith("State") ? "characters" : "words"
            }
        />
    );

    const address = (prefix: "billing" | "delivery") => (
        <Grid columns={ADDRESS_COLUMNS}>
            {/* The customer's name in two parts, so neither is left off; the delivery name
                is whoever receives it, in one. */}
            {prefix === "billing" ? (
                <>
                    {field("First name", "billingFirstName")}
                    {field("Last name", "billingLastName")}
                </>
            ) : (
                <Cell span={2}>{field("Name", "deliveryName")}</Cell>
            )}
            <Cell span={2}>{field("Address", `${prefix}Address` as keyof Order)}</Cell>
            {field("Unit #", `${prefix}Unit` as keyof Order)}
            {field("Floor", `${prefix}Floor` as keyof Order)}
            {field("Suite #", `${prefix}Suite` as keyof Order)}
            <Cell span={2}>{field("City", `${prefix}City` as keyof Order)}</Cell>
            {field("State", `${prefix}State` as keyof Order)}
            {field("Zip", `${prefix}Zip` as keyof Order, { inputMode: "tel" })}
            <Cell span={2}>
                {field("Cell #", `${prefix}Cell` as keyof Order, { type: "tel", inputMode: "tel" })}
            </Cell>
            <Cell span={2}>
                {field("Alt. #", `${prefix}Alt` as keyof Order, { type: "tel", inputMode: "tel" })}
            </Cell>
            <Cell span={2}>
                {field("Email", `${prefix}Email` as keyof Order, {
                    type: "email",
                    inputMode: "email",
                })}
            </Cell>
        </Grid>
    );

    const heading = (text: string) => (
        <Text className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {text}
        </Text>
    );

    return (
        <View className="gap-5">
            <View>
                {heading("Sale details")}
                <Grid columns={{ base: 1, sm: 2, md: 4, lg: 2, "2xl": 4 }}>
                    {field("Organization", "organization")}
                    {field("Advertising source", "advertisingSource")}
                    {field("Referral name", "referralName")}
                    <ComboField
                        label="CFS rep name"
                        value={form.cfsRepName ?? ""}
                        onChange={set("cfsRepName")}
                        onCommit={(value) => commitValue("cfsRepName", value)}
                        suggestions={reps}
                        disabled={disabled}
                    />
                </Grid>
            </View>

            <View>
                {heading("Customer billing name and address")}
                {address("billing")}
            </View>

            <View>
                {heading("Delivery address")}
                <Checkbox
                    label="Same as billing"
                    checked={form.deliverySameAsBilling ?? true}
                    onChange={toggleSameAsBilling}
                    disabled={disabled}
                    className="mb-3"
                />
                {!(form.deliverySameAsBilling ?? true) && address("delivery")}
            </View>

            <TextArea
                label="Comments"
                value={form.comments ?? ""}
                onChange={set("comments")}
                onBlur={commit("comments")}
                disabled={disabled}
                rows={3}
                maxLength={1000}
                placeholder="Anything the delivery crew or checkout table needs to know"
            />
        </View>
    );
};

export default CustomerForm;
