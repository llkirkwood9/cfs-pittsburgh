import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Button from "../Components/Elements/Button";
import Icon from "../Components/Elements/Icon";
import TextField from "../Components/Elements/TextField";
import { useAuth } from "../Context/AuthContext";
import { HomePathForRole } from "../Lib/RoleRoutes";
import { Toast } from "../Lib/Toast";

const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];

/**
 * Sign-in screen. The PIN goes in through an on-screen keypad rather than the tablet keyboard,
 * which is faster on a cart and keeps the soft keyboard from covering the form.
 */
const LoginPage = () => {
    const { user, loading, login } = useAuth();
    const navigate = useNavigate();

    // Read straight out of storage as the initial value rather than syncing it in an effect,
    // so the field is already filled on the very first paint.
    const [username, setUsername] = useState<string>(
        () => localStorage.getItem("cfs.lastUsername") ?? ""
    );
    const [pin, setPin] = useState<string>("");
    const [submitting, setSubmitting] = useState<boolean>(false);

    // On a laptop at the checkout table the PIN can be typed: digits and Backspace work the
    // keypad, and Enter signs in. Typing in the username box is left alone apart from Enter.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const inField = e.target instanceof HTMLInputElement;

            if (e.key === "Enter") {
                e.preventDefault();
                if (pin.length >= 4) document.getElementById("cfs-sign-in")?.click();
                else if (inField) (e.target as HTMLInputElement).blur();
                return;
            }
            if (inField) return;
            if (/^[0-9]$/.test(e.key))
                setPin((value) => (value.length >= 12 ? value : value + e.key));
            else if (e.key === "Backspace") setPin((value) => value.slice(0, -1));
            else if (e.key === "Escape") setPin("");
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [pin]);

    if (!loading && user) return <Navigate to={HomePathForRole(user.role)} replace />;

    const press = (key: string) => {
        if (key === "clear") return setPin("");
        if (key === "back") return setPin((value) => value.slice(0, -1));
        if (pin.length >= 12) return;
        setPin((value) => value + key);
    };

    const handleSubmit = async () => {
        if (!username.trim()) return Toast.Warning("Enter your username.");
        if (pin.length < 4) return Toast.Warning("Enter your PIN.");

        setSubmitting(true);
        const signedIn = await login(username.trim(), pin);
        setSubmitting(false);

        if (signedIn) {
            localStorage.setItem("cfs.lastUsername", username.trim());
            navigate(HomePathForRole(signedIn.role), { replace: true });
        } else {
            setPin("");
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-900 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-800">
                <div className="mb-6 flex flex-col items-center gap-2">
                    <Icon
                        icon="fa-solid fa-bed"
                        className="text-3xl text-sky-600 dark:text-sky-400"
                    />
                    <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                        CFS Pittsburgh
                    </h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Sign in to the cart</p>
                </div>

                <TextField
                    label="Username"
                    value={username}
                    onChange={setUsername}
                    className="mb-4"
                    maxLength={50}
                />

                <div className="mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        PIN
                    </span>
                    <div
                        className="mt-1 flex min-h-[48px] items-center justify-center gap-3 rounded-xl
                        border border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900"
                    >
                        {pin.length === 0 ? (
                            <span className="text-sm text-zinc-400">Enter your PIN</span>
                        ) : (
                            pin
                                .split("")
                                .map((_, index) => (
                                    <span
                                        key={index}
                                        className="h-3 w-3 rounded-full bg-sky-600 dark:bg-sky-400"
                                    />
                                ))
                        )}
                    </div>
                </div>

                <div className="mb-4 grid grid-cols-3 gap-2">
                    {keys.map((key) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => press(key)}
                            className="flex h-14 items-center justify-center rounded-xl bg-zinc-100 text-xl
                                font-semibold text-zinc-800 transition-colors active:scale-[0.97]
                                hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                        >
                            {key === "clear" ? (
                                <span className="text-sm">Clear</span>
                            ) : key === "back" ? (
                                <Icon icon="fa-solid fa-delete-left" className="text-lg" />
                            ) : (
                                key
                            )}
                        </button>
                    ))}
                </div>

                <Button
                    id="cfs-sign-in"
                    text="Sign in"
                    icon="fa-solid fa-right-to-bracket"
                    onClick={handleSubmit}
                    loading={submitting}
                    className="w-full"
                />
            </div>
        </div>
    );
};

export default LoginPage;
