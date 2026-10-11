import { useState } from "react";
import { TextInput, View } from "react-native";
import Button from "../Elements/Button";
import Text from "../Elements/Text";
import type { Order } from "../../Models/Order";

type Props = {
    order: Order;
    readOnly?: boolean;
    onSave: (changes: Order) => Promise<void>;
};

/**
 * The Comments box from the sales sheet, at the checkout table. The floor's note is shown here so
 * checkout sees it, and checkout can add to it - "deliver the pillow with the mattress" often
 * only comes up while the customer is paying. Keyed by order id by the caller, so switching
 * customers starts fresh.
 */
const CommentsCard = ({ order, readOnly = false, onSave }: Props) => {
    const [text, setText] = useState<string>(order.comments ?? "");
    const [saving, setSaving] = useState<boolean>(false);

    const dirty = text !== (order.comments ?? "");

    const save = async () => {
        if (!dirty) return;
        setSaving(true);
        await onSave({ comments: text });
        setSaving(false);
    };

    return (
        <View className="rounded-xl bg-white p-4 shadow-sm dark:bg-zinc-800">
            <View className="mb-3 min-h-[40px] flex-row flex-wrap items-center justify-between gap-2">
                <Text className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Comments
                </Text>
                {!readOnly && dirty && (
                    <Button
                        text="Save comment"
                        icon="fa-solid fa-check"
                        onClick={save}
                        loading={saving}
                        className="min-h-[40px] px-3 text-sm"
                    />
                )}
            </View>

            {readOnly ? (
                <Text className="text-sm text-zinc-700 dark:text-zinc-300">
                    {order.comments || "No comments."}
                </Text>
            ) : (
                <TextInput
                    value={text}
                    onChangeText={setText}
                    onBlur={save}
                    multiline
                    textAlignVertical="top"
                    maxLength={1000}
                    placeholder="Anything the delivery crew needs to know - printed in the Comments box"
                    placeholderTextColor="#a1a1aa"
                    accessibilityLabel="Comments"
                    style={{ minHeight: 92 }}
                    className="w-full rounded-xl border border-zinc-300 bg-white p-3 text-base text-zinc-900
                        focus:border-sky-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
            )}
        </View>
    );
};

export default CommentsCard;
