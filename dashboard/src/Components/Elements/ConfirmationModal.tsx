import Button from "./Button";
import Modal from "./Modal";

type Props = {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
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
    onConfirm,
    onCancel,
}: Props) => {
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
        </Modal>
    );
};

export default ConfirmationModal;
