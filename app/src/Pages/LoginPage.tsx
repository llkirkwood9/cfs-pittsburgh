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
import { GetServerUrl } from "../Lib/Server";
import { GetItem, SetItem } from "../Lib/Storage";
import { Toast } from "../Lib/Toast";

/**
 * Sign-in screen: username and password. Too many wrong passwords lock the account for a while,
 * and someone signing in for the first time - or with a password a manager set for them - is
 * asked to choose their own straight afterwards. The server is fixed when the app is built
 * (see Lib/Server).
 */
const LoginPage = () => {
    const { user, loading, login } = useAuth();
    const { settings } = useSettings();

    const [username, setUsername] = useState<string>(() => GetItem("cfs.lastUsername") ?? "");
    // Only the username is remembered on the device, never the password.
    const [password, setPassword] = useState<string>("");
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const [submitting, setSubmitting] = useState<boolean>(false);

    if (!loading && user) return <Redirect href={HomePathForRole(user.role)} />;

    const handleSubmit = async () => {
        if (!GetServerUrl())
            return Toast.Error(
                "This build of the app has no server address. Set EXPO_PUBLIC_API_URL."
            );
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
                                accessibilityLabel={
                                    showPassword ? "Hide password" : "Show password"
                                }
                                className="absolute bottom-0 right-0 h-12 w-12 items-center justify-center"
                            >
                                <Icon
                                    icon={
                                        showPassword ? "fa-solid fa-eye-slash" : "fa-solid fa-eye"
                                    }
                                    className="text-zinc-500 dark:text-zinc-400"
                                />
                            </Pressable>
                        </View>

                        <Button
                            text="Sign in"
                            icon="fa-solid fa-right-to-bracket"
                            onClick={handleSubmit}
                            loading={submitting}
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
