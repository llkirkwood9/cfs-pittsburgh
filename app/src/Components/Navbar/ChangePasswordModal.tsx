import { View } from "react-native";
import Button from "../Elements/Button";
import Modal from "../Elements/Modal";
import Text from "../Elements/Text";
import TextField from "../Elements/TextField";
import { useAuth } from "@shared/Context/AuthContext";
import { useChangePassword } from "@shared/Hooks/useChangePassword";

type Props = {
    onClose: () => void;
    /** First sign-in, or a password a manager set: there's no way out but choosing one (or signing out). */
    forced?: boolean;
};

/**
 * Lets the signed-in crew member choose a new password. The current one is asked for first, so
 * someone picking up a device left signed in can't lock its owner out. Every other device they
 * were signed in on is signed out; this one stays signed in.
 */
const ChangePasswordModal = ({ onClose, forced = false }: Props) => {
    const { logout } = useAuth();
    const { current, setCurrent, next, setNext, confirm, setConfirm, policy, saving, save } =
        useChangePassword(onClose);

    return (
        <Modal
            title={forced ? "Choose your password" : "Change your password"}
            onClose={onClose}
            dismissible={!forced}
            footer={
                <>
                    <Button
                        text={forced ? "Sign out" : "Cancel"}
                        onClick={forced ? logout : onClose}
                        className="bg-zinc-500 dark:bg-zinc-600"
                    />
                    <Button
                        text="Change password"
                        icon="fa-solid fa-key"
                        onClick={save}
                        loading={saving}
                    />
                </>
            }
        >
            <View className="gap-3">
                {forced && (
                    <Text className="rounded-xl bg-sky-50 p-3 text-sm text-sky-900 dark:bg-sky-950/50 dark:text-sky-100">
                        Before you carry on, choose a password of your own. Use the password you
                        just signed in with as the current one.
                    </Text>
                )}
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
                    onSubmit={save}
                    type="password"
                    maxLength={128}
                    autoComplete="new-password"
                />
                <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                    {policy} Forgot it? Your manager can reset it.
                </Text>
            </View>
        </Modal>
    );
};

export default ChangePasswordModal;
