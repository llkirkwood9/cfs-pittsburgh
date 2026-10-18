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
import { useRefreshOnFocus } from "../Hooks/UseRefreshOnFocus";
import { cx } from "../Lib/ClassNames";
import { FormatDateTime, FormatElapsed } from "../Lib/ModelHelpers";
import { Toast } from "../Lib/Toast";
import { UserRoleLabels } from "../Models/User";
import type { User, UserRole } from "../Models/User";
import { AddUser, DeleteUser, GetUsers, UpdateUser } from "../Services/UserServices";

const roles: UserRole[] = ["Sales", "Checkout", "SalesCheckout", "Admin", "SystemAdmin"];

const roleBlurb: Record<UserRole, string> = {
    Sales: "Takes orders on the floor",
    Checkout: "Takes payment and prints receipts",
    SalesCheckout: "Both tables, without the admin screens",
    Admin: "Everything, plus catalog and crew",
    SystemAdmin: "Everything, plus permanent deletes",
};

/**
 * Crew administration. Accounts are created here; there is no self-service signup, which keeps
 * a shared cart tablet from becoming a way in.
 */
const CrewPage = () => {
    const { user } = useAuth();

    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [editing, setEditing] = useState<User | null>(null);
    const [deactivating, setDeactivating] = useState<User | null>(null);
    const [removing, setRemoving] = useState<User | null>(null);
    const isSystemAdmin = user?.role === "SystemAdmin";
    const [saving, setSaving] = useState<boolean>(false);

    const [name, setName] = useState<string>("");
    const [username, setUsername] = useState<string>("");
    const [email, setEmail] = useState<string>("");
    const [role, setRole] = useState<UserRole>("Sales");
    const [pin, setPin] = useState<string>("");
    const [isActive, setIsActive] = useState<boolean>(true);

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

                <View className="gap-2">
                    {users.map((crew) => {
                        // An administrator can see a system admin's account but not change it.
                        const canChange = isSystemAdmin || crew.role !== "SystemAdmin";
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
                                    </View>
                                    <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                                        {crew.username} ·{" "}
                                        {crew.role ? UserRoleLabels[crew.role] : ""}
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
                        <TextField
                            label={editing.id ? "New PIN (leave blank to keep)" : "PIN"}
                            value={pin}
                            onChange={setPin}
                            inputMode="numeric"
                            maxLength={12}
                        />

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
                                {roles
                                    .filter((r) => r !== "SystemAdmin" || isSystemAdmin)
                                    .map((r) => {
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
