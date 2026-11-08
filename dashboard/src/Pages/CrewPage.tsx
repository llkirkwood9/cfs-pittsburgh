import Button from "../Components/Elements/Button";
import ConfirmationModal from "../Components/Elements/ConfirmationModal";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import Modal from "../Components/Elements/Modal";
import TextField from "../Components/Elements/TextField";
import { useCrew } from "@shared/Hooks/useCrew";
import { CrewRoleBlurbs, CrewTerritoryText, NeedsTerritory } from "@shared/Lib/Crew";
import { FormatDateTime, FormatElapsed } from "@shared/Lib/Format";
import { UserRoleLabels } from "@shared/Models/User";

const randomValues = (bytes: Uint32Array<ArrayBuffer>) => crypto.getRandomValues(bytes);

/**
 * Crew administration. Accounts are created here; there is no self-service signup, which keeps
 * a shared cart tablet from becoming a way in. Anyone below administrator works in one or more
 * territories - a rep who sells in two belongs to both and switches between them. Managers look
 * after the crew of their own territories; system admins and administrators everyone, in the
 * territory picked in the menu bar.
 */
const CrewPage = () => {
    const {
        user,
        users,
        loading,
        isSystemAdmin,
        assignable,
        activeTerritories,
        chooseTerritories,
        canManage,
        editing,
        elsewhere,
        editingSelf,
        form,
        setField,
        toggleTerritory,
        newPassword,
        open,
        close,
        saving,
        handleSave,
        deactivating,
        setDeactivating,
        handleDeactivate,
        removing,
        setRemoving,
        handleRemove,
    } = useCrew(randomValues);

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

            {users.length === 0 && (
                <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    No crew here yet. Click Add crew to set someone up.
                </p>
            )}

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
                                {CrewTerritoryText(crew)}
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
                        {isSystemAdmin && crew.id !== user?.id && (
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
                        {crew.isActive && crew.id !== user?.id && canManage(crew) && (
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
                    onClose={close}
                    footer={
                        <>
                            <Button
                                text="Cancel"
                                onClick={close}
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
                        <TextField
                            label="Name"
                            value={form.name}
                            onChange={(v) => setField("name", v)}
                            maxLength={150}
                        />
                        <TextField
                            label="Username"
                            value={form.username}
                            onChange={(v) => setField("username", v)}
                            maxLength={50}
                        />
                        <TextField
                            label="Email"
                            value={form.email}
                            onChange={(v) => setField("email", v)}
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
                                    value={form.password}
                                    onChange={(v) => setField("password", v)}
                                    maxLength={128}
                                    autoComplete="off"
                                    className="min-w-0 flex-1"
                                />
                                <button
                                    type="button"
                                    onClick={newPassword}
                                    title="Make a random password"
                                    aria-label="Make a random password"
                                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-100
                                        text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                                >
                                    <Icon icon="fa-solid fa-dice" />
                                </button>
                            </div>
                            {form.password && !editingSelf && (
                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                    They&apos;ll be asked to choose their own at sign-in.
                                </p>
                            )}
                        </div>

                        {NeedsTerritory(form.role) && chooseTerritories && (
                            <fieldset className="flex flex-col gap-1 sm:col-span-2">
                                <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                    Territories
                                </legend>
                                <div className="flex flex-wrap gap-2">
                                    {activeTerritories.map((t) => {
                                        const checked =
                                            t.id != null && form.territoryIds.includes(t.id);
                                        return (
                                            <label
                                                key={t.id}
                                                className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-medium ${
                                                    checked
                                                        ? "border-sky-600 bg-sky-50 text-sky-900 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-100"
                                                        : "border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
                                                } ${editingSelf ? "pointer-events-none opacity-60" : ""}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    disabled={editingSelf}
                                                    onChange={(e) =>
                                                        t.id != null &&
                                                        toggleTerritory(t.id, e.target.checked)
                                                    }
                                                    className="h-5 w-5 accent-sky-600"
                                                />
                                                {t.name}
                                            </label>
                                        );
                                    })}
                                </div>
                                {elsewhere.length > 0 && (
                                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                        Also works in {elsewhere.join(", ")}, which stays as it is.
                                    </span>
                                )}
                                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                    Someone in more than one territory picks which they&apos;re
                                    working in from the menu bar.
                                </span>
                            </fieldset>
                        )}

                        <div className="sm:col-span-2">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                Role
                            </p>
                            {editingSelf && (
                                <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                                    You can&apos;t change your own role.
                                </p>
                            )}
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {(editingSelf ? [form.role] : assignable).map((r) => (
                                    <button
                                        key={r}
                                        type="button"
                                        disabled={editingSelf}
                                        onClick={() => setField("role", r)}
                                        className={`flex min-h-[60px] flex-col items-start justify-center rounded-xl px-3 py-2
                                            text-left transition-colors ${
                                                form.role === r
                                                    ? "bg-sky-700 text-white dark:bg-sky-600"
                                                    : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                                            }`}
                                    >
                                        <span className="text-sm font-semibold">
                                            {UserRoleLabels[r]}
                                        </span>
                                        <span className="text-[11px] opacity-80">
                                            {CrewRoleBlurbs[r]}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl bg-zinc-100 px-3 sm:col-span-2 dark:bg-zinc-700">
                            <input
                                type="checkbox"
                                checked={form.isActive}
                                onChange={(e) => setField("isActive", e.target.checked)}
                                className="h-5 w-5 accent-sky-600"
                            />
                            <span className="text-sm font-medium">Can sign in</span>
                        </label>

                        {editing.isLockedOut && (
                            <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl bg-red-50 px-3 sm:col-span-2 dark:bg-red-950/40">
                                <input
                                    type="checkbox"
                                    checked={form.unlock}
                                    onChange={(e) => setField("unlock", e.target.checked)}
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
