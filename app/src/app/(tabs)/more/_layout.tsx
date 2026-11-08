import { Stack } from "expo-router";
import { useTheme } from "../../../Hooks/UseTheme";
import { InMoreStack } from "../../../Routes/InMoreStack";
import { Screens } from "@shared/Lib/Screens";

/**
 * The More tab: a menu of the screens that don't fit on the bar, each opening with a native
 * header and back button. The tab bar stays in view, as the dashboard's menu does.
 */
export default function MoreLayout() {
    const { isDark } = useTheme();

    return (
        <InMoreStack.Provider value={true}>
            <Stack
                screenOptions={{
                    headerBackTitle: "Back",
                    headerLargeTitle: false,
                    contentStyle: { backgroundColor: isDark ? "#18181b" : "#f4f4f5" },
                }}
            >
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="inventory/index" options={{ title: Screens.inventory.title }} />
                <Stack.Screen
                    name="inventory/count/[phase]"
                    options={{ title: Screens.inventoryCount.title }}
                />
                <Stack.Screen name="catalog" options={{ title: Screens.catalog.title }} />
                <Stack.Screen name="events/index" options={{ title: Screens.events.title }} />
                <Stack.Screen
                    name="events/[eventId]/close"
                    options={{ title: Screens.closeOut.title }}
                />
                <Stack.Screen name="crew" options={{ title: Screens.crew.title }} />
                <Stack.Screen name="settings" options={{ title: Screens.settings.title }} />
                <Stack.Screen name="territories" options={{ title: Screens.territories.title }} />
            </Stack>
        </InMoreStack.Provider>
    );
}
