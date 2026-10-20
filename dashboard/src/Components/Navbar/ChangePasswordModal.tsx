import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Button from "../Elements/Button";
import Modal from "../Elements/Modal";
import TextField from "../Elements/TextField";
import { useAuth } from "../../Context/AuthContext";
import { Toast } from "../../Lib/Toast";
import { ChangePassword, GetPasswordPolicy } from "../../Services/AuthServices";

type Props = {
    onClose: () => void;
    /** First sign-in, or a password a manager set: there's no way out but choosing one (or signing out). */
    forced?: boolean;
};

/**
 * Lets the signed-in crew member choose a new password. The current one is asked for first, so
 * someone picking up a tablet left signed in can't lock its owner out. Every other device they
 * were signed in on is signed out.
 */
const ChangePasswordModal = ({ onClose, forced = false }: Props) => {
    const { user, setProfile, logout } = useAuth();
    const [current, setCurrent] = useState<string>("");
    const [next, setNext] = useState<string>("");
    const [confirm, setConfirm] = useState<string>("");
    const [policy, setPolicy] = useState<string | null>(null);
    const [saving, setSaving] = useState<boolean>(false);

    useEffect(() => {
        GetPasswordPolicy().then(setPolicy);
    }, []);

    const save = async (e?: FormEvent) => {
        e?.preventDefault();
        if (!current) return Toast.Warning("Enter your current password.");
        if (next.length < 8)
            return Toast.Warning("The new password must be at least 8 characters.");
        if (next !== confirm)
            return Toast.Warning("The new password and its confirmation don't match.");
        if (next === current)
            return Toast.Warning("Choose a password different from your current one.");

        setSaving(true);
        const updated = await ChangePassword(current, next);
        setSaving(false);

        if (!updated) return;
        setProfile({ ...user, ...updated, mustChangePassword: false });
        Toast.Success(
            "Your password has been changed. Any other devices you were signed in on have been signed out."
        );
        onClose();
    };

    return (
        <Modal
            title={forced ? "Choose your password" : "Change your password"}
            onClose={onClose}
            dismissible={!forced}
            footer={
                <>
                    {forced ? (
                        <Button
                            text="Sign out"
                            onClick={logout}
                            className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                        />
                    ) : (
                        <Button
                            text="Cancel"
                            onClick={onClose}
                            className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                        />
                    )}
                    <Button
                        text="Change password"
                        icon="fa-solid fa-key"
                        onClick={save}
                        loading={saving}
                    />
                </>
            }
        >
            <form onSubmit={save} className="space-y-3">
                {forced && (
                    <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-900 dark:bg-sky-950/50 dark:text-sky-100">
                        Before you carry on, choose a password of your own. Use the password you
                        just signed in with as the current one.
                    </p>
                )}
                {/* Lets a password manager tie the new password to the right account. */}
                <input
                    type="text"
                    autoComplete="username"
                    value={user?.username ?? ""}
                    readOnly
                    hidden
                />
                <TextField
                    label="Current password"
                    value={current}
                    onChange={setCurrent}
                    type="password"
                    maxLength={128}
                    autoComplete="current-password"
                    autoFocus
                />
                <TextField
                    label="New password"
                    value={next}
                    onChange={setNext}
                    type="password"
                    maxLength={128}
                    autoComplete="new-password"
                />
                <TextField
                    label="New password again"
                    value={confirm}
                    onChange={setConfirm}
                    type="password"
                    maxLength={128}
                    autoComplete="new-password"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {policy ?? "At least 8 characters."} Forgot it? Your manager can reset it.
                </p>
                {/* Enter in any field submits. */}
                <button type="submit" hidden />
            </form>
        </Modal>
    );
};

export default ChangePasswordModal;
