import * as Crypto from "expo-crypto";
import { Redirect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Button from "../Components/Elements/Button";
import Checkbox from "../Components/Elements/Checkbox";
import ConfirmationModal from "../Components/Elements/ConfirmationModal";
import Grid, { Cell } from "../Components/Elements/Grid";
import Icon from "../Components/Elements/Icon";
import ListSkeleton from "../Components/Elements/ListSkeleton";
import Modal from "../Components/Elements/Modal";
import Page from "../Components/Elements/Page";
import SwipeRow from "../Components/Elements/SwipeRow";
import type { SwipeAction } from "../Components/Elements/SwipeRow";
import Text from "../Components/Elements/Text";
import TextField from "../Components/Elements/TextField";
import { useAuth } from "../Context/AuthContext";
import { useTerritory } from "../Context/TerritoryContext";
import { useRefreshOnFocus } from "../Hooks/UseRefreshOnFocus";
import { cx } from "../Lib/ClassNames";
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
    Manager: "Runs their territories: crew, events, catalog and settings",
    Admin: "Every territory, plus the Territories screen",
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
    const bytes = Crypto.getRandomValues(new Uint32Array(16));
    return Array.from(bytes, (b) => chars[b % chars.length]).join("");
};

/**
 * Crew administration. Accounts are created here; there is no self-service signup, which keeps
 * a shared device from becoming a way in. Managers look after the crew of their own territory;
 * system admins and administrators everyone, in the territory picked in the menu bar.
 */
const CrewPage = () => {
    const { user } = useAuth();
    const { territories, territoryId: territoryInView } = useTerritory();

    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
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
    const [territoryIds, setTerritoryIds] = useState<number[]>([]);
    const [isActive, setIsActive] = useState<boolean>(true);
    const [unlock, setUnlock] = useState<boolean>(false);

    const load = useCallback(async () => {
        setUsers(await GetUsers());
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    // Back on this screen: read it again.
    useRefreshOnFocus(load);

    if (!user) return <Redirect href="/unauthorized" />;

    const handleRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    // Matches the API: system admins manage everyone, administrators everyone but system admins,
    // managers only the Sales and Checkout crew of their own territories (and themselves, for their
    // details).
    const ownTerritoryIds = user.territoryIds ?? [];
    const canManage = (crew: User): boolean => {
        if (isSystemAdmin) return true;
        if (user.role === "Admin") return crew.role !== "SystemAdmin";
        if (crew.id === user.id) return true;
        return (
            (crew.territoryIds ?? []).some((id) => ownTerritoryIds.includes(id)) &&
            (crew.role === "Sales" || crew.role === "Checkout" || crew.role === "SalesCheckout")
        );
    };

    // The roles this user can give: never above their own, and a manager can't make managers.
    const assignable = roles.filter((r) => {
        if (r === "SystemAdmin") return isSystemAdmin;
        if (r === "Admin" || r === "Manager") return companyWide;
        return true;
    });
    // The territories this user can put people in: every switched-on one for system admins and
    // administrators, a manager's own for a manager.
    const activeTerritories = territories.filter((t) => t.isActive !== false);
    // Someone with only one territory to offer doesn't need to choose.
    const chooseTerritories = companyWide || activeTerritories.length > 1;

    const open = (crew: User) => {
        setEditing(crew);
        setName(crew.name ?? "");
        setUsername(crew.username ?? "");
        setEmail(crew.email ?? "");
        setRole(crew.role ?? "Sales");
        setIsActive(crew.isActive ?? true);
        setTerritoryIds(
            crew.id
                ? (crew.territoryIds ?? [])
                : territoryInView != null
                  ? [territoryInView]
                  : activeTerritories.length === 1 && activeTerritories[0].id != null
                    ? [activeTerritories[0].id]
                    : []
        );
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

        // A manager's choices are only their own territories; any others the person works in stay.
        const offered = activeTerritories.map((t) => t.id);
        const elsewhere = territoryIds.filter((id) => !offered.includes(id));
        const chosen = chooseTerritories
            ? territoryIds
            : [...elsewhere, ...offered.filter((id): id is number => id != null)];
        if (needsTerritory(role) && chosen.length === 0)
            return Toast.Warning("Pick at least one territory this person works in.");

        const payload: User = {
            id: editing?.id,
            name: name.trim(),
            username: username.trim(),
            email: email.trim(),
            role,
            territoryIds: needsTerritory(role) ? chosen : [],
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
            <Page edges={["left", "right"]}>
                <ListSkeleton rows={4} />
            </Page>
        );
    }

    return (
        <Page edges={["left", "right"]} onRefresh={handleRefresh} refreshing={refreshing}>
            <View className="mx-auto w-full max-w-3xl">
                <View className="mb-3 flex-row items-center justify-end">
                    <Button
                        text="Add crew"
                        icon="fa-solid fa-user-plus"
                        onClick={() => open({ role: "Sales", isActive: true })}
                        className="bg-green-700 dark:bg-green-600"
                    />
                </View>

                {users.length === 0 && (
                    <Text className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        No crew here yet. Tap Add crew to set someone up.
                    </Text>
                )}

                <View className="gap-2">
                    {users.map((crew) => {
                        // An administrator can see a system admin's account but not change it, and a
                        // manager only their own territory's floor and checkout crew.
                        const canChange = canManage(crew);
                        const actions: SwipeAction[] = [];
                        if (crew.isActive && crew.id !== user.id && canChange)
                            actions.push({
                                label: "Deactivate",
                                icon: "fa-solid fa-user-slash",
                                tone: "amber",
                                onPress: () => setDeactivating(crew),
                            });
                        if (isSystemAdmin && crew.id !== user.id)
                            actions.push({
                                label: "Delete",
                                icon: "fa-solid fa-trash",
                                tone: "danger",
                                onPress: () => setRemoving(crew),
                            });

                        return (
                            <SwipeRow
                                key={crew.id}
                                onPress={canChange ? () => open(crew) : undefined}
                                actions={actions}
                                accessibilityLabel={`${crew.name}, ${crew.role ? UserRoleLabels[crew.role] : ""}`}
                                className="flex-row items-center gap-3 p-4"
                            >
                                <View className="min-w-0 flex-1">
                                    <View className="flex-row flex-wrap items-center gap-2">
                                        <Text className="font-semibold">{crew.name}</Text>
                                        {!crew.isActive && (
                                            <View className="rounded bg-zinc-200 px-1.5 py-0.5 dark:bg-zinc-700">
                                                <Text className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                                    Inactive
                                                </Text>
                                            </View>
                                        )}
                                        {crew.isLockedOut && (
                                            <View className="rounded bg-red-100 px-1.5 py-0.5 dark:bg-red-950/50">
                                                <Text className="text-xs font-semibold text-red-800 dark:text-red-300">
                                                    Locked out
                                                </Text>
                                            </View>
                                        )}
                                        {crew.isActive && crew.mustChangePassword && (
                                            <View className="rounded bg-amber-100 px-1.5 py-0.5 dark:bg-amber-950/50">
                                                <Text className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                                                    New password pending
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                                        {crew.username} ·{" "}
                                        {crew.role ? UserRoleLabels[crew.role] : ""}
                                        {crew.territoryNames?.length
                                            ? ` · ${crew.territoryNames.join(", ")}`
                                            : crew.role && !needsTerritory(crew.role)
                                              ? " · All territories"
                                              : ""}
                                        {crew.email ? ` · ${crew.email}` : ""}
                                    </Text>
                                    {/* Sign-in times are only sent to a system admin. */}
                                    {isSystemAdmin && (
                                        <View className="mt-0.5 flex-row items-center gap-1.5">
                                            <Icon
                                                icon="fa-solid fa-clock-rotate-left"
                                                className="text-xs text-zinc-500 dark:text-zinc-400"
                                            />
                                            <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                                                {crew.lastLoginAt ? (
                                                    <>
                                                        Last login{" "}
                                                        {FormatDateTime(crew.lastLoginAt)}{" "}
                                                        <Text className="text-xs text-zinc-400 dark:text-zinc-500">
                                                            ({FormatElapsed(crew.lastLoginAt)})
                                                        </Text>
                                                    </>
                                                ) : (
                                                    "No sign-in recorded yet"
                                                )}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                {canChange && (
                                    <Icon
                                        icon="fa-solid fa-chevron-right"
                                        className="text-xs text-zinc-400"
                                    />
                                )}
                            </SwipeRow>
                        );
                    })}
                </View>
            </View>

            {editing && (
                <Modal
                    title={editing.id ? "Edit crew member" : "Add crew member"}
                    onClose={() => setEditing(null)}
                    footer={
                        <>
                            <Button
                                text="Cancel"
                                onClick={() => setEditing(null)}
                                className="bg-zinc-500 dark:bg-zinc-600"
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
                    <Grid columns={{ base: 1, sm: 2 }}>
                        <TextField
                            label="Name"
                            value={name}
                            onChange={setName}
                            maxLength={150}
                            autoCapitalize="words"
                        />
                        <TextField
                            label="Username"
                            value={username}
                            onChange={setUsername}
                            maxLength={50}
                            autoCapitalize="none"
                        />
                        <TextField
                            label="Email"
                            value={email}
                            onChange={setEmail}
                            type="email"
                            inputMode="email"
                            maxLength={200}
                        />
                        <View className="gap-1">
                            <View className="flex-row items-end gap-2">
                                <TextField
                                    label={
                                        editing.id
                                            ? "New password (blank to keep)"
                                            : "Starting password"
                                    }
                                    value={password}
                                    onChange={setPassword}
                                    maxLength={128}
                                    autoCapitalize="none"
                                    className="min-w-0 flex-1"
                                />
                                <Pressable
                                    onPress={() => setPassword(MakePassword())}
                                    accessibilityRole="button"
                                    accessibilityLabel="Make a random password"
                                    className="h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 active:bg-zinc-200 dark:bg-zinc-700 dark:active:bg-zinc-600"
                                >
                                    <Icon
                                        icon="fa-solid fa-dice"
                                        className="text-zinc-700 dark:text-zinc-100"
                                    />
                                </Pressable>
                            </View>
                            {password && editing.id !== user.id ? (
                                <Text className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                    They&apos;ll be asked to choose their own at sign-in.
                                </Text>
                            ) : null}
                        </View>

                        {needsTerritory(role) && chooseTerritories && (
                            <Cell span={{ base: 1, sm: 2 }}>
                                <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                    Territories
                                </Text>
                                <View className="flex-row flex-wrap gap-2">
                                    {activeTerritories.map((t) => (
                                        <Checkbox
                                            key={t.id}
                                            label={t.name ?? ""}
                                            checked={t.id != null && territoryIds.includes(t.id)}
                                            disabled={editing.id === user.id}
                                            onChange={(checked) =>
                                                t.id != null &&
                                                setTerritoryIds((ids) =>
                                                    checked ? [...ids, t.id!] : ids.filter((id) => id !== t.id)
                                                )
                                            }
                                        />
                                    ))}
                                </View>
                                {!companyWide &&
                                    (editing.territoryIds ?? []).some(
                                        (id) => !activeTerritories.some((t) => t.id === id)
                                    ) && (
                                        <Text className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                            Also works in{" "}
                                            {(editing.territoryNames ?? [])
                                                .filter(
                                                    (_, i) =>
                                                        !activeTerritories.some(
                                                            (t) => t.id === editing.territoryIds?.[i]
                                                        )
                                                )
                                                .join(", ")}
                                            , which stays as it is.
                                        </Text>
                                    )}
                                <Text className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                    Someone in more than one territory picks which they&apos;re working in from the menu bar.
                                </Text>
                            </Cell>
                        )}

                        <Cell span={{ base: 1, sm: 2 }}>
                            <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                Role
                            </Text>
                            {editing.id === user.id && (
                                <Text className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                                    You can&apos;t change your own role.
                                </Text>
                            )}
                            <Grid columns={{ base: 1, sm: 2 }} gap={8}>
                                {(editing.id === user.id ? [role] : assignable).map((r) => {
                                    const selected = role === r;
                                    return (
                                        <Pressable
                                            key={r}
                                            disabled={editing.id === user.id}
                                            onPress={() => setRole(r)}
                                            accessibilityRole="radio"
                                            accessibilityState={{
                                                checked: selected,
                                                disabled: editing.id === user.id,
                                            }}
                                            className={cx(
                                                "min-h-[60px] justify-center rounded-xl px-3 py-2",
                                                selected
                                                    ? "bg-sky-700 dark:bg-sky-600"
                                                    : "bg-zinc-100 active:bg-zinc-200 dark:bg-zinc-700 dark:active:bg-zinc-600",
                                                editing.id === user.id && "opacity-60"
                                            )}
                                        >
                                            <Text
                                                className={cx(
                                                    "text-sm font-semibold",
                                                    selected
                                                        ? "text-white"
                                                        : "text-zinc-800 dark:text-zinc-100"
                                                )}
                                            >
                                                {UserRoleLabels[r]}
                                            </Text>
                                            <Text
                                                className={cx(
                                                    "text-[11px]",
                                                    selected
                                                        ? "text-white/80"
                                                        : "text-zinc-600 dark:text-zinc-300"
                                                )}
                                            >
                                                {roleBlurb[r]}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </Grid>
                        </Cell>

                        <Cell span={{ base: 1, sm: 2 }}>
                            <Checkbox
                                label="Can sign in"
                                checked={isActive}
                                onChange={setIsActive}
                            />
                        </Cell>

                        {editing.isLockedOut && (
                            <Cell span={{ base: 1, sm: 2 }}>
                                <Checkbox
                                    label="Unlock - they entered the wrong password too many times"
                                    checked={unlock}
                                    onChange={setUnlock}
                                />
                            </Cell>
                        )}
                    </Grid>
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
        </Page>
    );
};

export default CrewPage;
