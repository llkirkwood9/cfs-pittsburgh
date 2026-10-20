import { Stack } from "expo-router";
import { useTheme } from "../../../Hooks/UseTheme";

/**
 * The More tab: a menu of the screens that don't fit on the bar, each opening with a native
 * header and back button. The tab bar stays in view, as the dashboard's menu does.
 */
export default function MoreLayout() {
    const { isDark } = useTheme();

    return (
        <Stack
            screenOptions={{
                headerBackTitle: "Back",
                headerLargeTitle: false,
                contentStyle: { backgroundColor: isDark ? "#18181b" : "#f4f4f5" },
            }}
        >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="inventory/index" options={{ title: "Inventory" }} />
            <Stack.Screen name="inventory/count/[phase]" options={{ title: "Inventory count" }} />
            <Stack.Screen name="catalog" options={{ title: "Catalog" }} />
            <Stack.Screen name="events/index" options={{ title: "Events" }} />
            <Stack.Screen name="events/[eventId]/close" options={{ title: "Close out event" }} />
            <Stack.Screen name="crew" options={{ title: "Crew" }} />
            <Stack.Screen name="settings" options={{ title: "Settings" }} />
            <Stack.Screen name="territories" options={{ title: "Territories" }} />
        </Stack>
    );
}
