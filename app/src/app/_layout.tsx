import "../global.css";

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import ConnectionBanner from "../Components/Elements/ConnectionBanner";
import ToastHost from "../Components/Elements/ToastHost";
import { AuthProvider } from "../Context/AuthContext";
import { SettingsProvider } from "../Context/SettingsContext";
import { ApplyStoredTheme, useTheme } from "../Hooks/UseTheme";
import { LoadStorage } from "../Lib/Storage";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

/**
 * The app shell, like the dashboard's main.tsx and App.tsx together: the sign-in session and
 * settings for every screen, the theme, the connection banner and toasts over everything. Nothing
 * draws until the device's saved server address, sign-in and theme have been read.
 */
export default function RootLayout() {
    const [ready, setReady] = useState<boolean>(false);

    useEffect(() => {
        LoadStorage()
            .then(ApplyStoredTheme)
            .finally(() => {
                setReady(true);
                SplashScreen.hideAsync().catch(() => undefined);
            });
    }, []);

    if (!ready) return null;

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <AuthProvider>
                <SettingsProvider>
                    <Shell />
                </SettingsProvider>
            </AuthProvider>
        </GestureHandlerRootView>
    );
}

/** The navigator, themed to match - the native tab bar and headers follow light and dark. */
const Shell = () => {
    const { isDark } = useTheme();

    // In the browser test build the dark: classes key off a class on the page, which NativeWind
    // only sets for an explicit Light or Dark; System needs it set from the resolved scheme.
    useEffect(() => {
        if (Platform.OS === "web") document.documentElement.classList.toggle("dark", isDark);
    }, [isDark]);

    return (
        <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
            <View className="flex-1 bg-zinc-100 dark:bg-zinc-900">
                <StatusBar style={isDark ? "light" : "dark"} />
                <Stack
                    screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: isDark ? "#18181b" : "#f4f4f5" },
                    }}
                >
                    <Stack.Screen name="index" />
                    <Stack.Screen name="login" options={{ animation: "fade" }} />
                    <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
                    <Stack.Screen
                        name="receipt/[orderId]"
                        options={{ headerShown: true, title: "Sales sheet", headerBackTitle: "Back" }}
                    />
                    <Stack.Screen
                        name="events/[eventId]/sheets"
                        options={{
                            headerShown: true,
                            title: "Event sheets",
                            headerBackTitle: "Back",
                        }}
                    />
                    <Stack.Screen
                        name="error"
                        options={{ headerShown: true, title: "Error", presentation: "modal" }}
                    />
                    <Stack.Screen name="unauthorized" />
                    <Stack.Screen name="+not-found" />
                </Stack>
                <ConnectionBanner />
                <ToastHost />
            </View>
        </ThemeProvider>
    );
};
