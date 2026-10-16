import { Redirect, router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Button from "../Components/Elements/Button";
import Icon from "../Components/Elements/Icon";
import KeyboardAvoider from "../Components/Elements/KeyboardAvoider";
import Text from "../Components/Elements/Text";
import TextField from "../Components/Elements/TextField";
import { useAuth } from "../Context/AuthContext";
import { useSettings } from "../Context/SettingsContext";
import { HomePathForRole } from "../Lib/RoleRoutes";
import { GetServerUrl, NormalizeServerUrl, SetServerUrl, TestServerUrl } from "../Lib/Server";
import { GetItem, SetItem } from "../Lib/Storage";
import { Toast } from "../Lib/Toast";

const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];

/**
 * Sign-in screen. The PIN goes in through an on-screen keypad rather than the keyboard, which is
 * faster on a cart and keeps the keyboard from covering the form. Unlike the dashboard - which is
 * served by the server it talks to - the app has to be told where the server is, so the first
 * time it asks for the server's address and checks that it answers.
 */
const LoginPage = () => {
    const { user, loading, login } = useAuth();
    const { settings } = useSettings();

    const [serverUrl, setServerUrlState] = useState<string | null>(GetServerUrl);
    const [editingServer, setEditingServer] = useState<boolean>(() => !GetServerUrl());
    const [serverText, setServerText] = useState<string>(() => GetServerUrl() ?? "");
    const [checkingServer, setCheckingServer] = useState<boolean>(false);

    const [username, setUsername] = useState<string>(() => GetItem("cfs.lastUsername") ?? "");
    const [pin, setPin] = useState<string>("");
    const [submitting, setSubmitting] = useState<boolean>(false);

    if (!loading && user) return <Redirect href={HomePathForRole(user.role)} />;

    const saveServer = async () => {
        const url = NormalizeServerUrl(serverText);
        if (!url) return Toast.Warning("Enter the server's address.");

        setCheckingServer(true);
        const answers = await TestServerUrl(url);
        setCheckingServer(false);

        if (!answers)
            return Toast.Error(
                `No CFS server answered at ${url}. Check the address and that this device is on the same Wi-Fi.`
            );

        SetServerUrl(url);
        setServerUrlState(url);
        setServerText(url);
        setEditingServer(false);
        Toast.Success("Connected to the server.");
    };

    const press = (key: string) => {
        if (key === "clear") return setPin("");
        if (key === "back") return setPin((value) => value.slice(0, -1));
        if (pin.length >= 12) return;
        setPin((value) => value + key);
    };

    const handleSubmit = async () => {
        if (!serverUrl) return Toast.Warning("Set the server's address first.");
        if (!username.trim()) return Toast.Warning("Enter your username.");
        if (pin.length < 4) return Toast.Warning("Enter your PIN.");

        setSubmitting(true);
        const signedIn = await login(username.trim(), pin);
        setSubmitting(false);

        if (signedIn) {
            SetItem("cfs.lastUsername", username.trim());
            router.replace(HomePathForRole(signedIn.role));
        } else {
            setPin("");
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-zinc-900">
            <KeyboardAvoider ios>
                <ScrollView
                    contentContainerClassName="grow items-center justify-center p-4"
                    keyboardShouldPersistTaps="handled"
                >
                    <View className="w-full max-w-sm rounded-2xl bg-white p-6 raised-2xl dark:bg-zinc-800">
                        <View className="mb-6 items-center gap-2">
                            <Icon
                                icon="fa-solid fa-bed"
                                className="text-3xl text-sky-600 dark:text-sky-400"
                            />
                            <Text className="text-xl font-bold">{settings.appName}</Text>
                        </View>

                        {editingServer ? (
                            <View className="mb-4 gap-2">
                                <TextField
                                    label="Server address"
                                    value={serverText}
                                    onChange={setServerText}
                                    onSubmit={saveServer}
                                    placeholder="ex. cfs.local:8080"
                                    autoCapitalize="none"
                                    inputMode="email"
                                />
                                <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                                    The address of the server.
                                </Text>
                                <View className="flex-row gap-2">
                                    {serverUrl && (
                                        <Button
                                            text="Cancel"
                                            onClick={() => {
                                                setServerText(serverUrl);
                                                setEditingServer(false);
                                            }}
                                            className="flex-1 bg-zinc-500 dark:bg-zinc-600"
                                        />
                                    )}
                                    <Button
                                        text="Connect"
                                        icon="fa-solid fa-plug"
                                        onClick={saveServer}
                                        loading={checkingServer}
                                        className="flex-1"
                                    />
                                </View>
                            </View>
                        ) : (
                            <Pressable
                                onPress={() => setEditingServer(true)}
                                accessibilityRole="button"
                                accessibilityLabel="Change the server address"
                                className="mb-4 flex-row items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2 active:bg-zinc-200 dark:bg-zinc-700 dark:active:bg-zinc-600"
                            >
                                <Icon
                                    icon="fa-solid fa-server"
                                    className="text-sm text-zinc-500 dark:text-zinc-400"
                                />
                                <Text
                                    className="flex-1 text-sm text-zinc-600 dark:text-zinc-300"
                                    numberOfLines={1}
                                >
                                    {serverUrl}
                                </Text>
                                <Text className="text-sm font-semibold text-sky-700 dark:text-sky-400">
                                    Change
                                </Text>
                            </Pressable>
                        )}

                        <TextField
                            label="Username"
                            value={username}
                            onChange={setUsername}
                            className="mb-4"
                            maxLength={50}
                            autoCapitalize="none"
                        />

                        <View className="mb-3">
                            <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                PIN
                            </Text>
                            <View
                                className="mt-1 min-h-[48px] flex-row items-center justify-center gap-3 rounded-xl
                                    border border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900"
                                accessibilityLabel={`${pin.length} digits entered`}
                            >
                                {pin.length === 0 ? (
                                    <Text className="text-sm text-zinc-400">Enter your PIN</Text>
                                ) : (
                                    pin
                                        .split("")
                                        .map((_, index) => (
                                            <View
                                                key={index}
                                                className="h-3 w-3 rounded-full bg-sky-600 dark:bg-sky-400"
                                            />
                                        ))
                                )}
                            </View>
                        </View>

                        <View className="mb-4 flex-row flex-wrap justify-between gap-y-2">
                            {keys.map((key) => (
                                <Pressable
                                    key={key}
                                    onPress={() => press(key)}
                                    accessibilityRole="button"
                                    accessibilityLabel={
                                        key === "back" ? "Delete" : key === "clear" ? "Clear" : key
                                    }
                                    className="h-14 w-[31.5%] items-center justify-center rounded-xl bg-zinc-100
                                        active:bg-zinc-200 dark:bg-zinc-700 dark:active:bg-zinc-600"
                                >
                                    {key === "clear" ? (
                                        <Text className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                                            Clear
                                        </Text>
                                    ) : key === "back" ? (
                                        <Icon
                                            icon="fa-solid fa-delete-left"
                                            className="text-lg text-zinc-800 dark:text-zinc-100"
                                        />
                                    ) : (
                                        <Text className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">
                                            {key}
                                        </Text>
                                    )}
                                </Pressable>
                            ))}
                        </View>

                        <Button
                            text="Sign in"
                            icon="fa-solid fa-right-to-bracket"
                            onClick={handleSubmit}
                            loading={submitting}
                            disabled={!serverUrl || editingServer}
                            className="w-full"
                        />
                    </View>
                </ScrollView>
            </KeyboardAvoider>
        </SafeAreaView>
    );
};

export default LoginPage;
