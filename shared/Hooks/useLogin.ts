import { useState } from "react";
import { DeviceStorage, HAS_SERVER, Toast } from "@host";
import { useAuth } from "../Context/AuthContext";
import { SharedStorageKeys } from "../Lib/StorageKeys";
import type { User } from "../Models/User";

/**
 * The sign-in form. Only the username is remembered on the device, never the password; a wrong
 * password clears the password box.
 * @param onSignedIn Called with the user once signed in, to go to their home screen.
 * @returns The fields, whether it is signing in, and the submit handler.
 */
export const useLogin = (onSignedIn: (user: User) => void) => {
    const { login } = useAuth();
    const [username, setUsername] = useState<string>(
        () => DeviceStorage.get(SharedStorageKeys.lastUsername) ?? ""
    );
    const [password, setPassword] = useState<string>("");
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const [submitting, setSubmitting] = useState<boolean>(false);

    const submit = async () => {
        if (!HAS_SERVER)
            return Toast.Error(
                "This build of the app has no server address. Set EXPO_PUBLIC_API_URL."
            );
        if (!username.trim()) return Toast.Warning("Enter your username.");
        if (!password) return Toast.Warning("Enter your password.");

        setSubmitting(true);
        const signedIn = await login(username.trim(), password);
        setSubmitting(false);

        if (signedIn) {
            DeviceStorage.set(SharedStorageKeys.lastUsername, username.trim());
            onSignedIn(signedIn);
        } else {
            setPassword("");
        }
    };

    return {
        username,
        setUsername,
        password,
        setPassword,
        showPassword,
        setShowPassword,
        submitting,
        submit,
    };
};
