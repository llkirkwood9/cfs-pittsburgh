import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Button from "../Components/Elements/Button";
import Icon from "../Components/Elements/Icon";
import TextField from "../Components/Elements/TextField";
import { useAuth } from "../Context/AuthContext";
import { useSettings } from "../Context/SettingsContext";
import { HomePathForRole } from "../Lib/RoleRoutes";
import { Toast } from "../Lib/Toast";

/**
 * Sign-in screen: username and password. Too many wrong passwords lock the account for a while,
 * and someone signing in for the first time - or with a password a manager set for them - is
 * asked to choose their own straight afterwards.
 */
const LoginPage = () => {
    const { user, loading, login } = useAuth();
    const { settings } = useSettings();
    const navigate = useNavigate();

    // Only the username is remembered on the device, never the password.
    const [username, setUsername] = useState<string>(() => {
        try {
            return localStorage.getItem("cfs.lastUsername") ?? "";
        } catch {
            return "";
        }
    });
    const [password, setPassword] = useState<string>("");
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const [submitting, setSubmitting] = useState<boolean>(false);

    if (!loading && user) return <Navigate to={HomePathForRole(user.role)} replace />;

    const handleSubmit = async (e?: FormEvent) => {
        e?.preventDefault();
        if (!username.trim()) return Toast.Warning("Enter your username.");
        if (!password) return Toast.Warning("Enter your password.");

        setSubmitting(true);
        const signedIn = await login(username.trim(), password);
        setSubmitting(false);

        if (signedIn) {
            try {
                localStorage.setItem("cfs.lastUsername", username.trim());
            } catch {
                // Private browsing: just don't remember it.
            }
            navigate(HomePathForRole(signedIn.role), { replace: true });
        } else {
            setPassword("");
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-900 p-4">
            <form
                onSubmit={handleSubmit}
                className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-800"
            >
                <div className="mb-6 flex flex-col items-center gap-2">
                    <Icon
                        icon="fa-solid fa-bed"
                        className="text-3xl text-sky-600 dark:text-sky-400"
                    />
                    <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                        {settings.appName}
                    </h1>
                </div>

                <TextField
                    label="Username"
                    value={username}
                    onChange={setUsername}
                    className="mb-4"
                    maxLength={50}
                    autoComplete="username"
                    autoFocus={!username}
                />

                <div className="relative mb-6">
                    <TextField
                        label="Password"
                        value={password}
                        onChange={setPassword}
                        type={showPassword ? "text" : "password"}
                        maxLength={128}
                        autoComplete="current-password"
                        autoFocus={Boolean(username)}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute bottom-0 right-0 flex h-12 w-12 items-center justify-center
                            text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
                    >
                        <Icon icon={showPassword ? "fa-solid fa-eye-slash" : "fa-solid fa-eye"} />
                    </button>
                </div>

                <Button
                    id="cfs-sign-in"
                    type="submit"
                    text="Sign in"
                    icon="fa-solid fa-right-to-bracket"
                    loading={submitting}
                    className="w-full"
                />

                <p className="mt-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
                    Forgotten your password? Ask your manager to set a new one.
                </p>
            </form>
        </div>
    );
};

export default LoginPage;
