import type { ReactNode } from "react";
import { View } from "react-native";
import Button from "./Button";
import Modal from "./Modal";
import Spinner from "./Spinner";
import Text from "./Text";
import TextArea from "./TextArea";
import TextField from "./TextField";
import { useEmailDialog } from "@shared/Hooks/useEmailDialog";
import type { EmailSend } from "@shared/Hooks/useEmailDialog";
import { Limits } from "@shared/Lib/Limits";

type Props = {
    title: string;
    /** What is being sent, shown above the address box. */
    description: ReactNode;
    /** Address to start with, such as the customer's email. */
    initialTo?: string | null;
    /** Offer a message box, for reports that go to a person rather than the customer. */
    withMessage?: boolean;
    /**
     * Builds the PDF and sends it; resolves to the addresses it went to, or null when it failed
     * (already reported). Calls progress with what it is doing, for a report that takes a while.
     */
    onSend: EmailSend;
    onClose: () => void;
};

/**
 * Asks who to email, then sends. Used for a customer's receipt and for an event's report.
 */
const EmailDialog = ({
    title,
    description,
    initialTo,
    withMessage = false,
    onSend,
    onClose,
}: Props) => {
    const { to, setTo, message, setMessage, sending, status, valid, send, close } = useEmailDialog(
        initialTo,
        onSend,
        onClose
    );

    return (
        <Modal
            title={title}
            onClose={close}
            footer={
                <>
                    <Button
                        text="Cancel"
                        onClick={close}
                        disabled={sending}
                        className="bg-zinc-500 dark:bg-zinc-600"
                    />
                    <Button
                        text={sending ? "Sending..." : "Send"}
                        icon="fa-solid fa-paper-plane"
                        onClick={send}
                        loading={sending}
                        disabled={!valid}
                        title={valid ? undefined : "Enter a valid email address"}
                    />
                </>
            }
        >
            <View className="gap-4">
                {typeof description === "string" ? (
                    <Text className="text-sm text-zinc-600 dark:text-zinc-400">{description}</Text>
                ) : (
                    description
                )}
                <TextField
                    label="Send to"
                    type="email"
                    inputMode="email"
                    value={to}
                    onChange={setTo}
                    onSubmit={send}
                    placeholder="name@example.com"
                    maxLength={Limits.emailTo}
                    autoFocus
                />
                {withMessage && (
                    <Text className="-mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                        Separate more than one address with commas.
                    </Text>
                )}
                {withMessage && (
                    <TextArea
                        label="Message (optional)"
                        value={message}
                        onChange={setMessage}
                        maxLength={Limits.emailMessage}
                        rows={3}
                    />
                )}
                {sending && (
                    <View accessibilityRole="progressbar" className="flex-row items-center gap-2">
                        <Spinner />
                        <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                            {status || "Sending..."}
                        </Text>
                    </View>
                )}
            </View>
        </Modal>
    );
};

export default EmailDialog;
