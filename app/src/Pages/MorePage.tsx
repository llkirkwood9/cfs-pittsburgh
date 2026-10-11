import { router } from "expo-router";
import type { Href } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import Icon from "../Components/Elements/Icon";
import Page from "../Components/Elements/Page";
import SizeGuideModal from "../Components/Elements/SizeGuideModal";
import Text from "../Components/Elements/Text";
import ChangePinModal from "../Components/Navbar/ChangePinModal";
import { useAuth } from "../Context/AuthContext";
import { useTheme } from "../Hooks/UseTheme";
import type { Theme } from "../Hooks/UseTheme";
import { cx } from "../Lib/ClassNames";
import { GetServerUrl } from "../Lib/Server";
import { APP_VERSION } from "../Lib/Version";
import type { UserRole } from "../Models/User";
import { UserRoleLabels } from "../Models/User";

type MenuItem = {
    href: Href;
    label: string;
    icon: string;
    roles?: UserRole[];
};

/** The dashboard's menu past the four tabs on the bar, in the same order. */
const items: MenuItem[] = [
    {
        href: "/more/inventory",
        label: "Inventory",
        icon: "fa-solid fa-boxes-stacked",
        roles: ["Checkout"],
    },
    { href: "/more/catalog", label: "Catalog", icon: "fa-solid fa-tags", roles: ["Admin"] },
    { href: "/more/events", label: "Events", icon: "fa-solid fa-calendar-days", roles: ["Admin"] },
    { href: "/more/crew", label: "Crew", icon: "fa-solid fa-users", roles: ["Admin"] },
    { href: "/more/settings", label: "Settings", icon: "fa-solid fa-gear", roles: ["Admin"] },
];

const themes: { value: Theme; label: string; icon: string }[] = [
    { value: "light", label: "Light", icon: "fa-solid fa-sun" },
    { value: "dark", label: "Dark", icon: "fa-solid fa-moon" },
    { value: "system", label: "System", icon: "fa-solid fa-circle-half-stroke" },
];

/** One row of a grouped list, iOS Settings style. */
const Row = ({
    icon,
    label,
    onPress,
    danger = false,
    last = false,
}: {
    icon: string;
    label: string;
    onPress: () => void;
    danger?: boolean;
    last?: boolean;
}) => (
    <Pressable
        onPress={onPress}
        accessibilityRole="button"
        className={cx(
            "min-h-[52px] flex-row items-center gap-3 px-4 active:bg-zinc-100 dark:active:bg-zinc-700",
            !last && "border-b border-zinc-100 dark:border-zinc-700"
        )}
    >
        <View
            className={cx(
                "h-8 w-8 items-center justify-center rounded-lg",
                danger ? "bg-red-600" : "bg-sky-700 dark:bg-sky-600"
            )}
        >
            <Icon icon={icon} className="text-sm text-white" />
        </View>
        <Text
            className={cx(
                "flex-1 text-base font-medium",
                danger ? "text-red-700 dark:text-red-400" : "text-zinc-900 dark:text-zinc-100"
            )}
        >
            {label}
        </Text>
        {!danger && <Icon icon="fa-solid fa-chevron-right" className="text-xs text-zinc-400" />}
    </Pressable>
);

/** A titled group of rows. */
const Group = ({ title, children }: { title?: string; children: React.ReactNode }) => (
    <View className="gap-2">
        {title && (
            <Text className="px-4 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {title}
            </Text>
        )}
        <View className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-zinc-800">
            {children}
        </View>
    </View>
);

/**
 * The More tab: the screens that don't fit on the tab bar, for the roles that use them, and the
 * things the dashboard keeps in its menu bar - the size chart, the theme, the signed-in crew
 * member, their PIN and signing out.
 */
const MorePage = () => {
    const { user, hasRole, logout } = useAuth();
    const { theme, setTheme } = useTheme();
    const [showSizes, setShowSizes] = useState<boolean>(false);
    const [changingPin, setChangingPin] = useState<boolean>(false);

    const visible = items.filter((item) => !item.roles || hasRole(...item.roles));

    const signOut = async () => {
        await logout();
        router.replace("/login");
    };

    return (
        <Page navbar>
            <View className="mx-auto w-full max-w-2xl gap-6">
                <View className="flex-row items-center gap-3 px-1">
                    <View className="h-12 w-12 items-center justify-center rounded-full bg-sky-600">
                        <Text className="text-lg font-bold text-white">
                            {(user?.name ?? "?")
                                .split(" ")
                                .map((part) => part.charAt(0))
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                        </Text>
                    </View>
                    <View className="flex-1">
                        <Text className="text-lg font-bold">{user?.name}</Text>
                        <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                            {user?.role ? UserRoleLabels[user.role] : ""}
                        </Text>
                    </View>
                </View>

                {visible.length > 0 && (
                    <Group>
                        {visible.map((item, index) => (
                            <Row
                                key={item.label}
                                icon={item.icon}
                                label={item.label}
                                onPress={() => router.push(item.href)}
                                last={index === visible.length - 1}
                            />
                        ))}
                    </Group>
                )}

                <Group>
                    <Row
                        icon="fa-solid fa-ruler-combined"
                        label="Mattress sizes"
                        onPress={() => setShowSizes(true)}
                        last
                    />
                </Group>

                <Group title="Theme">
                    <View className="flex-row gap-2 p-3">
                        {themes.map((option) => {
                            const active = theme === option.value;
                            const color = active
                                ? "text-white"
                                : "text-zinc-700 dark:text-zinc-200";
                            return (
                                <Pressable
                                    key={option.value}
                                    onPress={() => setTheme(option.value)}
                                    accessibilityRole="radio"
                                    accessibilityState={{ checked: active }}
                                    className={cx(
                                        "min-h-[48px] flex-1 flex-row items-center justify-center gap-2 rounded-xl",
                                        active
                                            ? "bg-sky-700 dark:bg-sky-600"
                                            : "bg-zinc-100 dark:bg-zinc-700"
                                    )}
                                >
                                    <Icon icon={option.icon} className={cx("text-sm", color)} />
                                    <Text className={cx("text-sm font-semibold", color)}>
                                        {option.label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </Group>

                <Group title="Account">
                    <Row
                        icon="fa-solid fa-key"
                        label="Change PIN"
                        onPress={() => setChangingPin(true)}
                    />
                    <Row
                        icon="fa-solid fa-right-from-bracket"
                        label="Sign out"
                        onPress={signOut}
                        danger
                        last
                    />
                </Group>

                <Text className="px-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
                    Version {APP_VERSION}
                    {"\n"}Server: {GetServerUrl()}
                </Text>
            </View>

            {showSizes && <SizeGuideModal onClose={() => setShowSizes(false)} />}
            {changingPin && <ChangePinModal onClose={() => setChangingPin(false)} />}
        </Page>
    );
};

export default MorePage;
