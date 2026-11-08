import { useEffect, useState } from "react";
import { Toast } from "@host";
import { useAuth } from "../Context/AuthContext";
import { DEFAULT_PASSWORD_POLICY, PasswordChangeProblem } from "../Lib/Passwords";
import { ChangePassword, GetPasswordPolicy } from "../Services/AuthServices";

/**
 * The change-password form: the three fields, the rules in words, and saving. Every other device
 * the user was signed in on is signed out; this one stays signed in.
 * @param onDone Called once the password has been changed.
 * @returns The form's state and its save handler.
 */
export const useChangePassword = (onDone: () => void) => {
    const { user, setProfile } = useAuth();
    const [current, setCurrent] = useState<string>("");
    const [next, setNext] = useState<string>("");
    const [confirm, setConfirm] = useState<string>("");
    const [policy, setPolicy] = useState<string | null>(null);
    const [saving, setSaving] = useState<boolean>(false);

    useEffect(() => {
        GetPasswordPolicy().then(setPolicy);
    }, []);

    const save = async () => {
        const problem = PasswordChangeProblem(current, next, confirm);
        if (problem) return Toast.Warning(problem);

        setSaving(true);
        const updated = await ChangePassword(current, next);
        setSaving(false);

        if (!updated) return;
        setProfile({ ...user, ...updated, mustChangePassword: false });
        Toast.Success(
            "Your password has been changed. Any other devices you were signed in on have been signed out."
        );
        onDone();
    };

    return {
        current,
        setCurrent,
        next,
        setNext,
        confirm,
        setConfirm,
        policy: policy ?? DEFAULT_PASSWORD_POLICY,
        saving,
        save,
    };
};
