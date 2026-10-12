import { useState } from "react";
import Button from "../Elements/Button";
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
        <div className="rounded-xl bg-white p-4 shadow-xs dark:bg-zinc-800">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Comments
                </h3>
                {!readOnly && dirty && (
                    <Button
                        text="Save comment"
                        icon="fa-solid fa-check"
                        onClick={save}
                        loading={saving}
                        className="min-h-[40px] px-3 text-sm"
                    />
                )}
            </div>

            {readOnly ? (
                <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                    {order.comments || "No comments."}
                </p>
            ) : (
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onBlur={save}
                    rows={3}
                    maxLength={1000}
                    placeholder="Anything the delivery crew needs to know - printed in the Comments box"
                    className="w-full rounded-xl border border-zinc-300 bg-white p-3 text-base text-zinc-900
                        outline-hidden focus:border-sky-600 focus:ring-2 focus:ring-sky-600/30
                        dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
            )}
        </div>
    );
};

export default CommentsCard;
