import { useState } from "react";
import Button from "./Button";
import Modal from "./Modal";

type Props = {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
    /** When set, the confirm button stays disabled until this word is typed - for deletes that cannot be undone. */
    confirmWord?: string;
    onConfirm: () => void;
    onCancel: () => void;
};

/**
 * Yes/no gate in front of anything the rep cannot undo: voiding a sale, deleting a draft,
 * removing a catalog row.
 */
const ConfirmationModal = ({
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    destructive = false,
    confirmWord,
    onConfirm,
    onCancel,
}: Props) => {
    const [typed, setTyped] = useState<string>("");
    const locked =
        Boolean(confirmWord) && typed.trim().toUpperCase() !== confirmWord?.toUpperCase();

    return (
        <Modal
            title={title}
            onClose={onCancel}
            footer={
                <>
                    <Button
                        text={cancelText}
                        onClick={onCancel}
                        className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                    />
                    <Button
                        text={confirmText}
                        onClick={onConfirm}
                        disabled={locked}
                        className={
                            destructive
                                ? "bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700"
                                : ""
                        }
                    />
                </>
            }
        >
            <p className="text-base text-zinc-700 dark:text-zinc-300">{message}</p>
            {confirmWord && (
                <label className="mt-4 flex flex-col gap-1">
                    <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        Type{" "}
                        <span className="font-bold text-red-700 dark:text-red-400">
                            {confirmWord}
                        </span>{" "}
                        to confirm
                    </span>
                    <input
                        value={typed}
                        onChange={(e) => setTyped(e.target.value)}
                        autoCapitalize="characters"
                        autoCorrect="off"
                        autoFocus
                        className="min-h-[48px] rounded-xl border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-none
                            focus:border-red-600 focus:ring-2 focus:ring-red-600/30 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                </label>
            )}
        </Modal>
    );
};

export default ConfirmationModal;
