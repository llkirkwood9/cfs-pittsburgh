import { useEffect, useEffectEvent, useState } from "react";
import { Alert, Platform, TextInput, View } from "react-native";
import Button from "./Button";
import Modal from "./Modal";
import Text from "./Text";

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
 * removing a catalog row. On a phone or tablet it's the system alert, with a destructive action
 * shown in red. One that needs a word typed first (a permanent delete) is a sheet with a box for
 * the word, as on the dashboard.
 */
const ConfirmationModal = (props: Props) => {
    if (props.confirmWord || Platform.OS === "web") return <TypedConfirmation {...props} />;
    return <SystemConfirmation {...props} />;
};

/** The system alert. Shown once when the component appears; it renders nothing itself. */
const SystemConfirmation = ({
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    destructive = false,
    onConfirm,
    onCancel,
}: Props) => {
    // The callbacks change on every render of the page; the alert calls whichever are current.
    const confirm = useEffectEvent(() => onConfirm());
    const cancel = useEffectEvent(() => onCancel());

    useEffect(() => {
        Alert.alert(
            title,
            message,
            [
                { text: cancelText, style: "cancel", onPress: () => cancel() },
                {
                    text: confirmText,
                    style: destructive ? "destructive" : "default",
                    onPress: () => confirm(),
                },
            ],
            { cancelable: true, onDismiss: () => cancel() }
        );
    }, [title, message, cancelText, confirmText, destructive]);

    return null;
};

/** The sheet, with a box for the confirm word when one is needed. */
const TypedConfirmation = ({
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
                        className="bg-zinc-500 dark:bg-zinc-600"
                    />
                    <Button
                        text={confirmText}
                        onClick={onConfirm}
                        disabled={locked}
                        className={destructive ? "bg-red-700 dark:bg-red-600" : ""}
                    />
                </>
            }
        >
            <Text className="text-base text-zinc-700 dark:text-zinc-300">{message}</Text>
            {confirmWord && (
                <View className="mt-4 gap-1">
                    <Text className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        Type{" "}
                        <Text className="text-sm font-bold text-red-700 dark:text-red-400">
                            {confirmWord}
                        </Text>{" "}
                        to confirm
                    </Text>
                    <TextInput
                        value={typed}
                        onChangeText={setTyped}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        autoFocus
                        accessibilityLabel={`Type ${confirmWord} to confirm`}
                        className="min-h-[48px] rounded-xl border border-zinc-300 bg-white px-3 text-base text-zinc-900
                            focus:border-red-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                </View>
            )}
        </Modal>
    );
};

export default ConfirmationModal;
