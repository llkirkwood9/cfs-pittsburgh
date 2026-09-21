import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import Button from "../Components/Elements/Button";
import ConfirmationModal from "../Components/Elements/ConfirmationModal";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import Modal from "../Components/Elements/Modal";
import TextField from "../Components/Elements/TextField";
import { useAuth } from "../Context/AuthContext";
import { Toast } from "../Lib/Toast";
import { UserRoleLabels } from "../Models/User";
import type { User, UserRole } from "../Models/User";
import { AddUser, DeleteUser, GetUsers, UpdateUser } from "../Services/UserServices";

const roles: UserRole[] = ["Sales", "Checkout", "SalesCheckout", "Admin"];

const roleBlurb: Record<UserRole, string> = {
    Sales: "Takes orders on the floor",
    Checkout: "Takes payment and prints receipts",
    SalesCheckout: "Both tables, without the admin screens",
    Admin: "Everything, plus catalog and crew",
};

/**
 * Crew administration. Accounts are created here; there is no self-service signup, which keeps
 * a shared cart tablet from becoming a way in.
 */
const CrewPage = () => {
    const { user } = useAuth();

    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [editing, setEditing] = useState<User | null>(null);
    const [deactivating, setDeactivating] = useState<User | null>(null);
    const [saving, setSaving] = useState<boolean>(false);

    const [name, setName] = useState<string>("");
    const [username, setUsername] = useState<string>("");
    const [email, setEmail] = useState<string>("");
    const [role, setRole] = useState<UserRole>("Sales");
    const [pin, setPin] = useState<string>("");
    const [isActive, setIsActive] = useState<boolean>(true);

    const load = async () => {
        setLoading(true);
        setUsers(await GetUsers());
        setLoading(false);
    };

    useEffect(() => {
        load();
    }, []);

    if (!user) return <Navigate to="/unauthorized" replace />;

    const open = (crew: User) => {
        setEditing(crew);
        setName(crew.name ?? "");
        setUsername(crew.username ?? "");
        setEmail(crew.email ?? "");
        setRole(crew.role ?? "Sales");
        setIsActive(crew.isActive ?? true);
        setPin("");
    };

    const handleSave = async () => {
        if (!name.trim()) return Toast.Warning("Enter the crew member's name.");
        if (!username.trim()) return Toast.Warning("Enter a username.");

        if (!editing?.id && pin.trim().length < 4)
            return Toast.Warning("Set a PIN of at least 4 digits.");

        if (pin.trim() && !/^\d{4,12}$/.test(pin.trim()))
            return Toast.Warning("The PIN must be 4 to 12 digits.");

        const payload: User = {
            id: editing?.id,
            name: name.trim(),
            username: username.trim(),
            email: email.trim(),
            role,
            isActive,
            pin: pin.trim() || undefined,
        };

        setSaving(true);
        const saved = editing?.id ? await UpdateUser(payload) : await AddUser(payload);
        setSaving(false);

        if (!saved) return;

        Toast.Success(`${saved.name} saved.`);
        setEditing(null);
        await load();
    };

    const handleDeactivate = async () => {
        if (!deactivating?.id) return;

        const success = await DeleteUser(deactivating.id);
        setDeactivating(null);

        if (success) {
            Toast.Success("Account deactivated.");
            await load();
        }
    };

    if (loading) {
        return (
            <div className="mx-auto max-w-3xl p-4">
                <ListSkeleton rows={4} />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-3xl p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-xl font-bold">Crew</h1>
                <Button
                    text="Add crew"
                    icon="fa-solid fa-user-plus"
                    onClick={() => open({ role: "Sales", isActive: true })}
                    className="bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
                />
            </div>

            <ul className="space-y-2">
                {users.map((crew) => (
                    <li
                        key={crew.id}
                        className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 shadow-sm dark:bg-zinc-800"
                    >
                        <div className="min-w-0 flex-1">
                            <p className="font-semibold">
                                {crew.name}
                                {!crew.isActive && (
                                    <span className="ml-2 rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
                                        Inactive
                                    </span>
                                )}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                {crew.username} &middot;{" "}
                                {crew.role ? UserRoleLabels[crew.role] : ""}
                                {crew.email ? ` · ${crew.email}` : ""}
                            </p>
                        </div>

                        <Button
                            text="Edit"
                            icon="fa-solid fa-pen"
                            onClick={() => open(crew)}
                            className="min-h-[40px] bg-zinc-500 px-3 text-sm hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                        />
                        {crew.isActive && crew.id !== user.id && (
                            <button
                                type="button"
                                onClick={() => setDeactivating(crew)}
                                aria-label="Deactivate account"
                                className="flex h-10 w-10 items-center justify-center rounded-lg text-red-700
                                    hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-950/40"
                            >
                                <Icon icon="fa-solid fa-user-slash" />
                            </button>
                        )}
                    </li>
                ))}
            </ul>

            {editing && (
                <Modal
                    title={editing.id ? "Edit crew member" : "Add crew member"}
                    onClose={() => setEditing(null)}
                    footer={
                        <>
                            <Button
                                text="Cancel"
                                onClick={() => setEditing(null)}
                                className="bg-zinc-500 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                            />
                            <Button
                                text="Save"
                                icon="fa-solid fa-check"
                                onClick={handleSave}
                                loading={saving}
                            />
                        </>
                    }
                >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <TextField label="Name" value={name} onChange={setName} maxLength={150} />
                        <TextField
                            label="Username"
                            value={username}
                            onChange={setUsername}
                            maxLength={50}
                        />
                        <TextField
                            label="Email"
                            value={email}
                            onChange={setEmail}
                            type="email"
                            inputMode="email"
                            maxLength={200}
                        />
                        <TextField
                            label={editing.id ? "New PIN (leave blank to keep)" : "PIN"}
                            value={pin}
                            onChange={setPin}
                            inputMode="numeric"
                            maxLength={12}
                        />

                        <div className="sm:col-span-2">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                Role
                            </p>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {roles.map((r) => (
                                    <button
                                        key={r}
                                        type="button"
                                        onClick={() => setRole(r)}
                                        className={`flex min-h-[60px] flex-col items-start justify-center rounded-xl px-3 py-2
                                            text-left transition-colors ${
                                                role === r
                                                    ? "bg-sky-700 text-white dark:bg-sky-600"
                                                    : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                                            }`}
                                    >
                                        <span className="text-sm font-semibold">
                                            {UserRoleLabels[r]}
                                        </span>
                                        <span className="text-[11px] opacity-80">
                                            {roleBlurb[r]}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl bg-zinc-100 px-3 sm:col-span-2 dark:bg-zinc-700">
                            <input
                                type="checkbox"
                                checked={isActive}
                                onChange={(e) => setIsActive(e.target.checked)}
                                className="h-5 w-5 accent-sky-600"
                            />
                            <span className="text-sm font-medium">Can sign in</span>
                        </label>
                    </div>
                </Modal>
            )}

            {deactivating && (
                <ConfirmationModal
                    title="Deactivate account"
                    message={`Deactivate ${deactivating.name}? They will be signed out and cannot sign back in. Their past sales stay on file.`}
                    confirmText="Deactivate"
                    destructive
                    onConfirm={handleDeactivate}
                    onCancel={() => setDeactivating(null)}
                />
            )}
        </div>
    );
};

export default CrewPage;
