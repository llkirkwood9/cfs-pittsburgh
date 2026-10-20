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

/**
 * Sign-in screen: username and password. Too many wrong passwords lock the account for a while,
 * and someone signing in for the first time - or with a password a manager set for them - is
 * asked to choose their own straight afterwards. Unlike the dashboard - which is served by the
 * server it talks to - the app has to be told where the server is, so the first time it asks for
 * the server's address and checks that it answers.
 */
const LoginPage = () => {
    const { user, loading, login } = useAuth();
    const { settings } = useSettings();

    const [serverUrl, setServerUrlState] = useState<string | null>(GetServerUrl);
    const [editingServer, setEditingServer] = useState<boolean>(() => !GetServerUrl());
    const [serverText, setServerText] = useState<string>(() => GetServerUrl() ?? "");
    const [checkingServer, setCheckingServer] = useState<boolean>(false);

    const [username, setUsername] = useState<string>(() => GetItem("cfs.lastUsername") ?? "");
    // Only the username is remembered on the device, never the password.
    const [password, setPassword] = useState<string>("");
    const [showPassword, setShowPassword] = useState<boolean>(false);
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
                `No CFS server answered at ${url}. Check the address and this device's internet connection.`
            );

        SetServerUrl(url);
        setServerUrlState(url);
        setServerText(url);
        setEditingServer(false);
        Toast.Success("Connected to the server.");
    };

    const handleSubmit = async () => {
        if (!serverUrl) return Toast.Warning("Set the server's address first.");
        if (!username.trim()) return Toast.Warning("Enter your username.");
        if (!password) return Toast.Warning("Enter your password.");

        setSubmitting(true);
        const signedIn = await login(username.trim(), password);
        setSubmitting(false);

        if (signedIn) {
            SetItem("cfs.lastUsername", username.trim());
            router.replace(HomePathForRole(signedIn.role));
        } else {
            setPassword("");
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
                                    placeholder="ex. sales.example.com"
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
                            autoComplete="username"
                        />

                        <View className="mb-6">
                            <TextField
                                label="Password"
                                value={password}
                                onChange={setPassword}
                                onSubmit={handleSubmit}
                                type={showPassword ? "text" : "password"}
                                maxLength={128}
                                autoCapitalize="none"
                                autoComplete="current-password"
                            />
                            <Pressable
                                onPress={() => setShowPassword((v) => !v)}
                                accessibilityRole="button"
                                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                                className="absolute bottom-0 right-0 h-12 w-12 items-center justify-center"
                            >
                                <Icon
                                    icon={showPassword ? "fa-solid fa-eye-slash" : "fa-solid fa-eye"}
                                    className="text-zinc-500 dark:text-zinc-400"
                                />
                            </Pressable>
                        </View>

                        <Button
                            text="Sign in"
                            icon="fa-solid fa-right-to-bracket"
                            onClick={handleSubmit}
                            loading={submitting}
                            disabled={!serverUrl || editingServer}
                            className="w-full"
                        />

                        <Text className="mt-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
                            Forgot your password? Ask your manager to set a new one.
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoider>
        </SafeAreaView>
    );
};

export default LoginPage;
