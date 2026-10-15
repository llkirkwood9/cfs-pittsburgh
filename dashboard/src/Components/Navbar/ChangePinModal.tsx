import { useState } from "react";
import Button from "../Elements/Button";
import Modal from "../Elements/Modal";
import TextField from "../Elements/TextField";
import { Toast } from "../../Lib/Toast";
import { ChangePin } from "../../Services/AuthServices";

type Props = {
    onClose: () => void;
};

/**
 * Lets the signed-in crew member choose a new PIN without asking an administrator. The current
 * PIN is asked for first, so someone picking up a tablet left signed in cannot lock its owner out.
 */
const ChangePinModal = ({ onClose }: Props) => {
    const [current, setCurrent] = useState<string>("");
    const [next, setNext] = useState<string>("");
    const [confirm, setConfirm] = useState<string>("");
    const [saving, setSaving] = useState<boolean>(false);

    const digits = (value: string) => value.replace(/\D/g, "").slice(0, 12);

    const save = async () => {
        if (current.length < 4) return Toast.Warning("Enter your current PIN.");
        if (next.length < 4) return Toast.Warning("The new PIN must be 4 to 12 digits.");
        if (next !== confirm) return Toast.Warning("The new PIN and its confirmation don't match.");
        if (next === current) return Toast.Warning("Choose a PIN different from your current one.");

        setSaving(true);
        const changed = await ChangePin(current, next);
        setSaving(false);

        if (!changed) return;
        Toast.Success("Your PIN has been changed. Use the new one next time you sign in.");
        onClose();
    };

    return (
        <Modal
            title="Change your PIN"
            onClose={onClose}
            footer={
                <>
                    <Button
                        text="Cancel"
                        onClick={onClose}
                        className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                    />
                    <Button
                        text="Change PIN"
                        icon="fa-solid fa-key"
                        onClick={save}
                        loading={saving}
                    />
                </>
            }
        >
            <div className="space-y-3">
                <TextField
                    label="Current PIN"
                    value={current}
                    onChange={(v) => setCurrent(digits(v))}
                    type="password"
                    inputMode="numeric"
                    autoFocus
                />
                <TextField
                    label="New PIN (4 to 12 digits)"
                    value={next}
                    onChange={(v) => setNext(digits(v))}
                    type="password"
                    inputMode="numeric"
                />
                <TextField
                    label="New PIN again"
                    value={confirm}
                    onChange={(v) => setConfirm(digits(v))}
                    type="password"
                    inputMode="numeric"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Forgot it? An administrator can reset it.
                </p>
            </div>
        </Modal>
    );
};

export default ChangePinModal;
