import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import Button from "../Components/Elements/Button";
import ConfirmationModal from "../Components/Elements/ConfirmationModal";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import Modal from "../Components/Elements/Modal";
import TextField from "../Components/Elements/TextField";
import { useAuth } from "../Context/AuthContext";
import { useTerritory } from "../Context/TerritoryContext";
import { FormatDateTime, FormatElapsed } from "../Lib/ModelHelpers";
import { Toast } from "../Lib/Toast";
import { IsCompanyWide, UserRoleLabels } from "../Models/User";
import type { User, UserRole } from "../Models/User";
import { AddUser, DeleteUser, GetUsers, UpdateUser } from "../Services/UserServices";

const roles: UserRole[] = ["Sales", "Checkout", "SalesCheckout", "Manager", "Admin", "SystemAdmin"];

const roleBlurb: Record<UserRole, string> = {
    Sales: "Takes orders on the floor",
    Checkout: "Takes payment and prints receipts",
    SalesCheckout: "Both tables, without the admin screens",
    Manager: "Runs one territory: its crew, events, catalog items and settings",
    Admin: "Every territory, plus territories and global catalog",
    SystemAdmin: "Everything, plus permanent deletes",
};

/** System Admins and administrators work across every territory; every other role belongs to one. */
const needsTerritory = (role: UserRole) => !IsCompanyWide(role);

/**
 * A random password for a new account or a reset, to hand to the crew member. They choose their
 * own at their first sign-in.
 * @returns 16 characters, avoiding ones that are easy to misread.
 */
const MakePassword = (): string => {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    const bytes = new Uint32Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => chars[b % chars.length]).join("");
};

/**
 * Crew administration. Accounts are created here; there is no self-service signup, which keeps
 * a shared cart tablet from becoming a way in. Managers look after the crew of their own
 * territory; system admins and administrators everyone, in the territory picked in the menu bar.
 */
const CrewPage = () => {
    const { user } = useAuth();
    const { territories, territoryId: territoryInView } = useTerritory();

    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [editing, setEditing] = useState<User | null>(null);
    const [deactivating, setDeactivating] = useState<User | null>(null);
    const [removing, setRemoving] = useState<User | null>(null);
    const isSystemAdmin = user?.role === "SystemAdmin";
    const companyWide = IsCompanyWide(user?.role);
    const [saving, setSaving] = useState<boolean>(false);

    const [name, setName] = useState<string>("");
    const [username, setUsername] = useState<string>("");
    const [email, setEmail] = useState<string>("");
    const [role, setRole] = useState<UserRole>("Sales");
    const [password, setPassword] = useState<string>("");
    const [territoryId, setTerritoryId] = useState<number | null>(null);
    const [isActive, setIsActive] = useState<boolean>(true);
    const [unlock, setUnlock] = useState<boolean>(false);

    const load = async () => {
        setLoading(true);
        setUsers(await GetUsers());
        setLoading(false);
    };

    useEffect(() => {
        load();
    }, []);

    if (!user) return <Navigate to="/unauthorized" replace />;

    // Matches the API: system admins manage everyone, administrators everyone but system admins, managers only
    // the Sales and Checkout crew of their own territory (and themselves, for their details).
    const canManage = (crew: User): boolean => {
        if (isSystemAdmin) return true;
        if (user.role === "Admin") return crew.role !== "SystemAdmin";
        if (crew.id === user.id) return true;
        return (
            crew.territoryId === user.territoryId &&
            (crew.role === "Sales" || crew.role === "Checkout" || crew.role === "SalesCheckout")
        );
    };

    // The roles this user can give: never above their own, and a manager can't make managers.
    const assignable = roles.filter((r) => {
        if (r === "SystemAdmin") return isSystemAdmin;
        if (r === "Admin") return companyWide;
        if (r === "Manager") return companyWide;
        return true;
    });
    const activeTerritories = territories.filter((t) => t.isActive !== false);

    const open = (crew: User) => {
        setEditing(crew);
        setName(crew.name ?? "");
        setUsername(crew.username ?? "");
        setEmail(crew.email ?? "");
        setRole(crew.role ?? "Sales");
        setIsActive(crew.isActive ?? true);
        setTerritoryId(crew.territoryId ?? territoryInView ?? user?.territoryId ?? null);
        setUnlock(false);
        // A new account gets a ready-made password to hand over; an existing one keeps its own
        // unless a new one is entered.
        setPassword(crew.id ? "" : MakePassword());
    };

    const handleSave = async () => {
        if (!name.trim()) return Toast.Warning("Enter the crew member's name.");
        if (!username.trim()) return Toast.Warning("Enter a username.");

        if (!editing?.id && !password) return Toast.Warning("Set a starting password.");

        if (password && password.length < 8)
            return Toast.Warning("The password must be at least 8 characters.");

        if (companyWide && needsTerritory(role) && territoryId == null)
            return Toast.Warning("Pick the territory this person works in.");

        const payload: User = {
            id: editing?.id,
            name: name.trim(),
            username: username.trim(),
            email: email.trim(),
            role,
            territoryId: needsTerritory(role)
                ? companyWide
                    ? territoryId
                    : user?.territoryId
                : null,
            isActive,
            password: password || undefined,
            isLockedOut: unlock ? false : undefined,
        };

        setSaving(true);
        const saved = editing?.id ? await UpdateUser(payload) : await AddUser(payload);
        setSaving(false);

        if (!saved) return;

        Toast.Success(
            password
                ? `${saved.name} saved. Give them the password - they'll choose their own when they sign in.`
                : `${saved.name} saved.`
        );
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

    // System admin only: delete the account for good. Their sales stay; every place that named them is cleared.
    const handleRemove = async () => {
        if (!removing?.id) return;

        const success = await DeleteUser(removing.id, true);
        setRemoving(null);

        if (success) {
            Toast.Success("Account deleted.");
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
                        className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 shadow-xs dark:bg-zinc-800"
                    >
                        <div className="min-w-0 flex-1">
                            <p className="font-semibold">
                                {crew.name}
                                {!crew.isActive && (
                                    <span className="ml-2 rounded-sm bg-zinc-200 px-1.5 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
                                        Inactive
                                    </span>
                                )}
                                {crew.isLockedOut && (
                                    <span className="ml-2 rounded-sm bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-950/50 dark:text-red-300">
                                        Locked out
                                    </span>
                                )}
                                {crew.isActive && crew.mustChangePassword && (
                                    <span className="ml-2 rounded-sm bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                                        New password pending
                                    </span>
                                )}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                {crew.username} &middot;{" "}
                                {crew.role ? UserRoleLabels[crew.role] : ""}
                                {crew.territoryName
                                    ? ` · ${crew.territoryName}`
                                    : crew.role && !needsTerritory(crew.role)
                                      ? " · All territories"
                                      : ""}
                                {crew.email ? ` · ${crew.email}` : ""}
                            </p>
                            {/* Sign-in times are only sent to a system admin. */}
                            {isSystemAdmin && (
                                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                                    <Icon icon="fa-solid fa-clock-rotate-left" />
                                    {crew.lastLoginAt ? (
                                        <span>
                                            Last login {FormatDateTime(crew.lastLoginAt)}{" "}
                                            <span className="text-zinc-400 dark:text-zinc-500">
                                                ({FormatElapsed(crew.lastLoginAt)})
                                            </span>
                                        </span>
                                    ) : (
                                        <span>No sign-in recorded yet</span>
                                    )}
                                </p>
                            )}
                        </div>

                        {/* An administrator can see a system admin's account but not change it. */}
                        {canManage(crew) && (
                            <Button
                                text="Edit"
                                icon="fa-solid fa-pen"
                                onClick={() => open(crew)}
                                className="min-h-[40px] bg-zinc-500 px-3 text-sm hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                            />
                        )}
                        {isSystemAdmin && crew.id !== user.id && (
                            <button
                                type="button"
                                onClick={() => setRemoving(crew)}
                                aria-label="Delete account permanently"
                                title="Delete permanently"
                                className="flex h-10 w-10 items-center justify-center rounded-lg text-red-700
                                    hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-950/40"
                            >
                                <Icon icon="fa-solid fa-trash" />
                            </button>
                        )}
                        {crew.isActive && crew.id !== user.id && canManage(crew) && (
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
                        <div className="flex flex-col gap-1">
                            <div className="flex items-end gap-2">
                                <TextField
                                    label={
                                        editing.id
                                            ? "New password (leave blank to keep)"
                                            : "Starting password"
                                    }
                                    value={password}
                                    onChange={setPassword}
                                    maxLength={128}
                                    autoComplete="off"
                                    className="min-w-0 flex-1"
                                />
                                <button
                                    type="button"
                                    onClick={() => setPassword(MakePassword())}
                                    title="Make a random password"
                                    aria-label="Make a random password"
                                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-100
                                        text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                                >
                                    <Icon icon="fa-solid fa-dice" />
                                </button>
                            </div>
                            {password && editing.id !== user.id && (
                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                    They&apos;ll be asked to choose their own at sign-in.
                                </p>
                            )}
                        </div>

                        {companyWide && needsTerritory(role) && (
                            <label className="flex flex-col gap-1 sm:col-span-2">
                                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                    Territory
                                </span>
                                <select
                                    value={territoryId ?? ""}
                                    disabled={editing.id === user.id}
                                    onChange={(e) =>
                                        setTerritoryId(
                                            e.target.value ? Number(e.target.value) : null
                                        )
                                    }
                                    className="min-h-[48px] rounded-xl border border-zinc-300 bg-white px-3 text-base
                                        dark:border-zinc-600 dark:bg-zinc-800 dark:scheme-dark"
                                >
                                    <option value="">Pick a territory...</option>
                                    {activeTerritories.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}

                        <div className="sm:col-span-2">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                Role
                            </p>
                            {editing.id === user.id && (
                                <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                                    You can&apos;t change your own role.
                                </p>
                            )}
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {(editing.id === user.id ? [role] : assignable).map((r) => (
                                    <button
                                        key={r}
                                        type="button"
                                        disabled={editing.id === user.id}
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

                        {editing.isLockedOut && (
                            <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl bg-red-50 px-3 sm:col-span-2 dark:bg-red-950/40">
                                <input
                                    type="checkbox"
                                    checked={unlock}
                                    onChange={(e) => setUnlock(e.target.checked)}
                                    className="h-5 w-5 accent-sky-600"
                                />
                                <span className="text-sm font-medium">
                                    Unlock - they entered the wrong password too many times
                                </span>
                            </label>
                        )}
                    </div>
                </Modal>
            )}

            {removing && (
                <ConfirmationModal
                    title="Delete account permanently"
                    message={`Delete ${removing.name}'s account for good? Their sales stay on file, but their name is cleared from them - the CFS rep and checkout names on those sales sheets will print blank. This cannot be undone. To keep their name on past sales, deactivate the account instead.`}
                    confirmText="Delete for good"
                    confirmWord="DELETE"
                    destructive
                    onConfirm={handleRemove}
                    onCancel={() => setRemoving(null)}
                />
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
