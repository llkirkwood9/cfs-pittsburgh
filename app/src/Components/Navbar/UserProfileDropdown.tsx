import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import ChangePasswordModal from "./ChangePasswordModal";
import Icon from "../Elements/Icon";
import Modal from "../Elements/Modal";
import Text from "../Elements/Text";
import { useAuth } from "../../Context/AuthContext";
import { GetServerUrl } from "../../Lib/Server";
import { APP_VERSION } from "../../Lib/Version";
import { UserRoleLabels } from "../../Models/User";

/**
 * Shows who is signed in on this device and offers sign-out. The crew shares devices, so the
 * current name stays visible rather than being buried in a settings screen.
 */
const UserProfileDropdown = () => {
    const { user, logout } = useAuth();
    const [open, setOpen] = useState<boolean>(false);
    const [changingPassword, setChangingPassword] = useState<boolean>(false);

    const handleLogout = async () => {
        setOpen(false);
        await logout();
        router.replace("/login");
    };

    const initials = (user?.name ?? "?")
        .split(" ")
        .map((part) => part.charAt(0))
        .join("")
        .slice(0, 2)
        .toUpperCase();

    return (
        <>
            <Pressable
                onPress={() => setOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={`Signed in as ${user?.name ?? "unknown"}`}
                className="h-11 flex-row items-center gap-2 rounded-xl px-2 active:bg-white/10"
            >
                <View className="h-8 w-8 items-center justify-center rounded-full bg-sky-600">
                    <Text className="text-sm font-bold text-white">{initials}</Text>
                </View>
                <Icon icon="fa-solid fa-chevron-down" className="text-xs text-zinc-200" />
            </Pressable>

            {open && (
                <Modal title={user?.name ?? "Signed in"} onClose={() => setOpen(false)}>
                    <View className="border-b border-zinc-200 pb-3 dark:border-zinc-700">
                        <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                            {user?.role ? UserRoleLabels[user.role] : ""}
                            {user?.territoryName ? ` · ${user.territoryName}` : ""} · v{APP_VERSION}
                        </Text>
                        <Text className="text-xs text-zinc-500 dark:text-zinc-400" numberOfLines={1}>
                            Server: {GetServerUrl()}
                        </Text>
                    </View>
                    <Pressable
                        onPress={() => {
                            setOpen(false);
                            setChangingPassword(true);
                        }}
                        accessibilityRole="button"
                        className="mt-2 min-h-[48px] flex-row items-center gap-3 rounded-lg px-3 active:bg-zinc-100 dark:active:bg-zinc-700"
                    >
                        <Icon icon="fa-solid fa-key" className="text-zinc-800 dark:text-zinc-100" />
                        <Text className="text-base font-medium text-zinc-800 dark:text-zinc-100">
                            Change password
                        </Text>
                    </Pressable>
                    <Pressable
                        onPress={handleLogout}
                        accessibilityRole="button"
                        className="mt-1 min-h-[48px] flex-row items-center gap-3 rounded-lg px-3 active:bg-red-50 dark:active:bg-red-950/40"
                    >
                        <Icon icon="fa-solid fa-right-from-bracket" className="text-red-700 dark:text-red-400" />
                        <Text className="text-base font-medium text-red-700 dark:text-red-400">
                            Sign out
                        </Text>
                    </Pressable>
                </Modal>
            )}
            {changingPassword && <ChangePasswordModal onClose={() => setChangingPassword(false)} />}
        </>
    );
};

export default UserProfileDropdown;
