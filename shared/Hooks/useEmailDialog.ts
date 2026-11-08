import { useState } from "react";
import { Toast } from "@host";
import { LooksLikeAddresses } from "../Lib/Email";

/** Builds the PDF and sends it; resolves to the addresses it went to, or null when it failed. */
export type EmailSend = (
    to: string,
    message: string,
    progress: (status: string) => void
) => Promise<string[] | null>;

/**
 * The email dialog: who to send to, an optional message, and sending - which can't be stopped half
 * way, so the dialog stays open until it finishes.
 * @param initialTo Address to start with, such as the customer's email.
 * @param onSend Builds the PDF and sends it, reporting what it is doing.
 * @param onClose Closes the dialog.
 * @returns The fields, whether the addresses look right, progress, and the send and close handlers.
 */
export const useEmailDialog = (
    initialTo: string | null | undefined,
    onSend: EmailSend,
    onClose: () => void
) => {
    const [to, setTo] = useState<string>(initialTo ?? "");
    const [message, setMessage] = useState<string>("");
    const [sending, setSending] = useState<boolean>(false);
    const [status, setStatus] = useState<string>("");

    const valid = LooksLikeAddresses(to);

    const send = async () => {
        if (!valid || sending) return;
        setSending(true);
        setStatus("");
        const sentTo = await onSend(to.trim(), message.trim(), setStatus);
        setSending(false);
        setStatus("");
        if (!sentTo) return;
        Toast.Success(`Emailed to ${sentTo.join(", ")}.`);
        onClose();
    };

    const close = () => {
        if (!sending) onClose();
    };

    return { to, setTo, message, setMessage, sending, status, valid, send, close };
};
