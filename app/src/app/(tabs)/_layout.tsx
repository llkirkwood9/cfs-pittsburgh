import { Redirect } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { View } from "react-native";
import LoadingPage from "../../Components/Elements/LoadingPage";
import ChangePasswordModal from "../../Components/Navbar/ChangePasswordModal";
import { useAuth } from "../../Context/AuthContext";
import { useTerritory } from "../../Context/TerritoryContext";
import { useCheckoutWaiting } from "../../Hooks/UseCheckoutWaiting";

/**
 * The native tab bar - Liquid Glass on iOS 26, Material on Android - in place of the dashboard's
 * menu bar. The same screens show for the same roles; the rest of the menu (Inventory, Catalog,
 * Events, Crew, Settings) is under More, as it is on the dashboard when the bar is full.
 *
 * Tabs can't be added or removed while the bar is on screen, so they are fixed per sign-in: the
 * bar only appears once someone is signed in, and signing out leaves it.
 */
export default function TabsLayout() {
    const { user, loading, hasRole, logout } = useAuth();
    // Customers waiting at the checkout table, on the Checkout tab's badge - in the territory in
    // view; with every territory in view there's no one checkout table to count.
    const { territoryId, canSwitch } = useTerritory();
    const waiting = useCheckoutWaiting(
        Boolean(user) && hasRole("Checkout") && (territoryId != null || !canSwitch),
        territoryId
    );

    if (loading) return <LoadingPage onSignOut={logout} />;
    if (!user) return <Redirect href="/login" />;

    // First sign-in, or a password a manager set: nothing else until they choose their own.
    if (user.mustChangePassword) {
        return (
            <View className="flex-1 bg-zinc-100 dark:bg-zinc-900">
                <ChangePasswordModal forced onClose={() => undefined} />
            </View>
        );
    }

    return (
        <NativeTabs minimizeBehavior="onScrollDown">
            <NativeTabs.Trigger name="sales" hidden={!hasRole("Sales")}>
                <NativeTabs.Trigger.Label>Sell</NativeTabs.Trigger.Label>
                <NativeTabs.Trigger.Icon
                    sf={{ default: "cart.badge.plus", selected: "cart.fill.badge.plus" }}
                    md="add_shopping_cart"
                />
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="checkout" hidden={!hasRole("Checkout")}>
                <NativeTabs.Trigger.Label>Checkout</NativeTabs.Trigger.Label>
                <NativeTabs.Trigger.Badge hidden={waiting === 0}>
                    {String(waiting)}
                </NativeTabs.Trigger.Badge>
                <NativeTabs.Trigger.Icon
                    sf={{ default: "creditcard", selected: "creditcard.fill" }}
                    md="point_of_sale"
                />
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="orders">
                <NativeTabs.Trigger.Label>Orders</NativeTabs.Trigger.Label>
                <NativeTabs.Trigger.Icon
                    sf={{ default: "doc.text", selected: "doc.text.fill" }}
                    md="description"
                />
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="dashboard">
                <NativeTabs.Trigger.Label>Dashboard</NativeTabs.Trigger.Label>
                <NativeTabs.Trigger.Icon
                    sf={{ default: "chart.bar", selected: "chart.bar.fill" }}
                    md="bar_chart"
                />
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="more">
                <NativeTabs.Trigger.Label>More</NativeTabs.Trigger.Label>
                <NativeTabs.Trigger.Icon
                    sf={{ default: "ellipsis.circle", selected: "ellipsis.circle.fill" }}
                    md="more_horiz"
                />
            </NativeTabs.Trigger>
        </NativeTabs>
    );
}
