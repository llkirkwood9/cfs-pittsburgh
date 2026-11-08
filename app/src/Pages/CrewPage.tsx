import * as Crypto from "expo-crypto";
import { useState } from "react";
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
import { useTerritory } from "@shared/Context/TerritoryContext";
import { useRefreshOnFocus } from "../Hooks/UseRefreshOnFocus";
import { cx } from "../Lib/ClassNames";
import { useCrew } from "@shared/Hooks/useCrew";
import { CrewRoleBlurbs, CrewTerritoryText, NeedsTerritory } from "@shared/Lib/Crew";
import { FormatDateTime, FormatElapsed } from "@shared/Lib/Format";
import { UserRoleLabels } from "@shared/Models/User";

/**
 * Crew administration. Accounts are created here; there is no self-service signup, which keeps
 * a shared device from becoming a way in. Anyone below administrator works in one or more
 * territories. Managers look after the crew of their own territories; system admins and
 * administrators everyone, in the territory picked in the menu bar.
 */
const CrewPage = () => {
    const { territories, territoryId: territoryInView } = useTerritory();
    const {
        user,
        users,
        loading,
        load,
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
    } = useCrew(territories, territoryInView, Crypto.getRandomValues);
    const [refreshing, setRefreshing] = useState<boolean>(false);

    // Back on this screen: read it again.
    useRefreshOnFocus(load);

    const handleRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
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
                        // manager only their own territories' floor and checkout crew.
                        const canChange = canManage(crew);
                        const actions: SwipeAction[] = [];
                        if (crew.isActive && crew.id !== user?.id && canChange)
                            actions.push({
                                label: "Deactivate",
                                icon: "fa-solid fa-user-slash",
                                tone: "amber",
                                onPress: () => setDeactivating(crew),
                            });
                        if (isSystemAdmin && crew.id !== user?.id)
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
                                        {CrewTerritoryText(crew)}
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
                    onClose={close}
                    footer={
                        <>
                            <Button
                                text="Cancel"
                                onClick={close}
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
                            value={form.name}
                            onChange={(v) => setField("name", v)}
                            maxLength={150}
                            autoCapitalize="words"
                        />
                        <TextField
                            label="Username"
                            value={form.username}
                            onChange={(v) => setField("username", v)}
                            maxLength={50}
                            autoCapitalize="none"
                        />
                        <TextField
                            label="Email"
                            value={form.email}
                            onChange={(v) => setField("email", v)}
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
                                    value={form.password}
                                    onChange={(v) => setField("password", v)}
                                    maxLength={128}
                                    autoCapitalize="none"
                                    className="min-w-0 flex-1"
                                />
                                <Pressable
                                    onPress={newPassword}
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
                            {form.password && !editingSelf ? (
                                <Text className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                    They&apos;ll be asked to choose their own at sign-in.
                                </Text>
                            ) : null}
                        </View>

                        {NeedsTerritory(form.role) && chooseTerritories && (
                            <Cell span={{ base: 1, sm: 2 }}>
                                <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                    Territories
                                </Text>
                                <View className="flex-row flex-wrap gap-2">
                                    {activeTerritories.map((t) => (
                                        <Checkbox
                                            key={t.id}
                                            label={t.name ?? ""}
                                            checked={
                                                t.id != null && form.territoryIds.includes(t.id)
                                            }
                                            disabled={editingSelf}
                                            onChange={(checked) =>
                                                t.id != null && toggleTerritory(t.id, checked)
                                            }
                                        />
                                    ))}
                                </View>
                                {elsewhere.length > 0 && (
                                    <Text className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                        Also works in {elsewhere.join(", ")}, which stays as it is.
                                    </Text>
                                )}
                                <Text className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                    Someone in more than one territory picks which they&apos;re
                                    working in from the menu bar.
                                </Text>
                            </Cell>
                        )}

                        <Cell span={{ base: 1, sm: 2 }}>
                            <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                Role
                            </Text>
                            {editingSelf && (
                                <Text className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                                    You can&apos;t change your own role.
                                </Text>
                            )}
                            <Grid columns={{ base: 1, sm: 2 }} gap={8}>
                                {(editingSelf ? [form.role] : assignable).map((r) => {
                                    const selected = form.role === r;
                                    return (
                                        <Pressable
                                            key={r}
                                            disabled={editingSelf}
                                            onPress={() => setField("role", r)}
                                            accessibilityRole="radio"
                                            accessibilityState={{
                                                checked: selected,
                                                disabled: editingSelf,
                                            }}
                                            className={cx(
                                                "min-h-[60px] justify-center rounded-xl px-3 py-2",
                                                selected
                                                    ? "bg-sky-700 dark:bg-sky-600"
                                                    : "bg-zinc-100 active:bg-zinc-200 dark:bg-zinc-700 dark:active:bg-zinc-600",
                                                editingSelf && "opacity-60"
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
                                                {CrewRoleBlurbs[r]}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </Grid>
                        </Cell>

                        <Cell span={{ base: 1, sm: 2 }}>
                            <Checkbox
                                label="Can sign in"
                                checked={form.isActive}
                                onChange={(v) => setField("isActive", v)}
                            />
                        </Cell>

                        {editing.isLockedOut && (
                            <Cell span={{ base: 1, sm: 2 }}>
                                <Checkbox
                                    label="Unlock - they entered the wrong password too many times"
                                    checked={form.unlock}
                                    onChange={(v) => setField("unlock", v)}
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
